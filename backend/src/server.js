const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { getDb } = require("./db");
const { categorize, learnFromCorrection } = require("./categorize");
const { detectRecurring, flagPossiblyUnused } = require("./recurring");
const { computeForecast } = require("./forecast");

const app = express();
app.use(cors());
app.use(express.json());

const db = getDb();

// demo auth: single seeded user, resolved by email header for simplicity.
// A real deployment would replace this with session/JWT auth + the 2FA flow
// described in the architecture doc.
function currentUser(req, res, next) {
  const user = db.prepare(`SELECT * FROM users LIMIT 1`).get();
  if (!user) return res.status(500).json({ error: "no seeded user — run `npm run seed`" });
  req.user = user;
  next();
}
app.use(currentUser);

function audit(userId, action, resource) {
  db.prepare(`INSERT INTO audit_log (user_id, actor, action, resource) VALUES (?, ?, ?, ?)`)
    .run(userId, "user", action, resource);
}

// ---------- accounts ----------
app.get("/api/accounts", (req, res) => {
  const accounts = db.prepare(`SELECT * FROM linked_accounts WHERE user_id = ?`).all(req.user.id);
  audit(req.user.id, "read", "linked_accounts");
  res.json(accounts);
});

// mock "sync" — a real integration would call the bank connector layer here.
app.post("/api/accounts/:id/sync", (req, res) => {
  db.prepare(`UPDATE linked_accounts SET last_synced_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .run(req.params.id, req.user.id);
  audit(req.user.id, "sync", `linked_accounts:${req.params.id}`);
  res.json({ status: "ok", synced_at: new Date().toISOString(), note: "mock sync — no live bank connection in this environment" });
});

// ---------- categories ----------
app.get("/api/categories", (req, res) => {
  res.json(db.prepare(`SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?`).all(req.user.id));
});

// ---------- transactions ----------
app.get("/api/transactions", (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const txns = db
    .prepare(
      `SELECT t.*, c.name_he as category_name
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? ORDER BY t.posted_date DESC LIMIT ?`
    )
    .all(req.user.id, limit);
  audit(req.user.id, "read", "transactions");
  res.json(txns);
});

// recategorize a transaction — also feeds the learning engine
app.patch("/api/transactions/:id/category", (req, res) => {
  const { category_id } = req.body;
  if (!category_id) return res.status(400).json({ error: "category_id required" });

  const txn = db.prepare(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!txn) return res.status(404).json({ error: "not found" });

  db.prepare(`UPDATE transactions SET category_id = ?, category_source = 'user' WHERE id = ?`)
    .run(category_id, txn.id);
  learnFromCorrection(db, { userId: req.user.id, merchantRaw: txn.merchant_raw, categoryId: category_id });
  audit(req.user.id, "recategorize", `transactions:${txn.id}`);

  res.json({ status: "ok" });
});

// ---------- recurring charges ----------
app.get("/api/recurring", (req, res) => {
  const rows = db
    .prepare(
      `SELECT r.*, c.name_he as category_name
       FROM recurring_charges r LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?`
    )
    .all(req.user.id);
  res.json(rows);
});

// re-run detection against current transaction history (idempotent-ish demo endpoint)
app.post("/api/recurring/detect", (req, res) => {
  const detected = detectRecurring(db, req.user.id);
  const flagged = flagPossiblyUnused(detected, ["חדר כושר Holmes Place", "מנוי עיתון הארץ"]);
  res.json(flagged);
});

// ---------- budgets ----------
app.get("/api/budgets", (req, res) => {
  const month = req.query.month || "2026-07";
  const rows = db
    .prepare(
      `SELECT b.*, c.name_he as category_name,
        (SELECT COALESCE(SUM(ABS(t.amount_agorot)), 0) FROM transactions t
         WHERE t.category_id = b.category_id AND t.user_id = b.user_id
         AND t.amount_agorot < 0 AND strftime('%Y-%m', t.posted_date) = b.month) as spent_agorot
       FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.month = ?`
    )
    .all(req.user.id, month);
  res.json(rows);
});

// ---------- forecast ----------
app.get("/api/forecast", (req, res) => {
  const forecast = computeForecast(db, req.user.id, new Date("2026-07-19"));
  res.json(forecast);
});

// ---------- goals ----------
app.get("/api/goals", (req, res) => {
  res.json(db.prepare(`SELECT * FROM savings_goals WHERE user_id = ?`).all(req.user.id));
});

// ---------- alerts (derived, not stored) ----------
app.get("/api/alerts", (req, res) => {
  const month = "2026-07";
  const budgets = db
    .prepare(
      `SELECT b.*, c.name_he as category_name,
        (SELECT COALESCE(SUM(ABS(t.amount_agorot)), 0) FROM transactions t
         WHERE t.category_id = b.category_id AND t.user_id = b.user_id
         AND t.amount_agorot < 0 AND strftime('%Y-%m', t.posted_date) = b.month) as spent_agorot
       FROM budgets b LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ? AND b.month = ?`
    )
    .all(req.user.id, month);

  const alerts = [];
  for (const b of budgets) {
    if (b.spent_agorot > b.limit_agorot) {
      alerts.push({
        kind: "overrun",
        title: `חריגה מתקציב: ${b.category_name}`,
        detail: `נוצל ${(b.spent_agorot / 100).toFixed(0)}₪ מתוך ${(b.limit_agorot / 100).toFixed(0)}₪`,
      });
    } else if (b.spent_agorot / b.limit_agorot >= 0.9) {
      alerts.push({
        kind: "warning",
        title: `מתקרב לתקציב: ${b.category_name}`,
        detail: `${Math.round((b.spent_agorot / b.limit_agorot) * 100)}% מהתקציב נוצל`,
      });
    }
  }

  const unused = db
    .prepare(`SELECT * FROM recurring_charges WHERE user_id = ? AND status = 'flagged_unused'`)
    .all(req.user.id);
  if (unused.length) {
    alerts.push({
      kind: "subscription",
      title: `${unused.length} מנויים שאולי אינם בשימוש`,
      detail: unused.map((u) => u.merchant_clean).join(", "),
    });
  }

  const forecast = computeForecast(db, req.user.id, new Date("2026-07-19"));
  if (forecast.projected_closing_balance_agorot < 100000) {
    alerts.push({
      kind: "low_balance",
      title: "יתרה נמוכה צפויה בסוף החודש",
      detail: `תחזית סגירה: ₪${(forecast.projected_closing_balance_agorot / 100).toFixed(0)}`,
    });
  }

  res.json(alerts);
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Pinkas API listening on :${PORT}`));
}
module.exports = app;
