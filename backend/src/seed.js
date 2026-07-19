const { getDb } = require("./db");
const { categorize } = require("./categorize");
const { detectRecurring, flagPossiblyUnused } = require("./recurring");
const crypto = require("crypto");

const id = () => crypto.randomUUID();

function seed() {
  const db = getDb();

  // wipe for idempotent re-seeding
  [
    "audit_log", "savings_goals", "budgets", "recurring_charges",
    "transactions", "merchant_category_rules", "categories",
    "linked_accounts", "users", "households",
  ].forEach((t) => db.prepare(`DELETE FROM ${t}`).run());

  const householdId = id();
  db.prepare(`INSERT INTO households (id, name) VALUES (?, ?)`).run(householdId, "משפחת כהן");

  const userId = id();
  const partnerId = id();
  db.prepare(`INSERT INTO users (id, email, full_name, household_id) VALUES (?, ?, ?, ?)`)
    .run(userId, "noa@example.com", "נועה כהן", householdId);
  db.prepare(`INSERT INTO users (id, email, full_name, household_id) VALUES (?, ?, ?, ?)`)
    .run(partnerId, "dan@example.com", "דן כהן", householdId);

  const categories = [
    ["מזון", "expense"], ["תחבורה", "expense"], ["בילויים ותרבות", "expense"],
    ["חשבונות ודיור", "expense"], ["בריאות", "expense"], ["קניות", "expense"],
    ["חשמל ואנרגיה", "expense"], ["הכנסה", "income"], ["אחר", "expense"],
  ];
  const catId = {};
  for (const [name, kind] of categories) {
    const cid = id();
    catId[name] = cid;
    db.prepare(`INSERT INTO categories (id, user_id, name_he, kind) VALUES (?, NULL, ?, ?)`)
      .run(cid, name, kind);
  }

  const accHapoalim = id();
  const accMax = id();
  const accIsracard = id();
  db.prepare(
    `INSERT INTO linked_accounts (id, user_id, institution, account_type, display_name, vault_credential_id, balance_agorot, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(accHapoalim, userId, "בנק הפועלים", "checking", "עו״ש עיקרי", "vault-ref-1", 812340);
  db.prepare(
    `INSERT INTO linked_accounts (id, user_id, institution, account_type, display_name, vault_credential_id, balance_agorot, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(accMax, userId, "מקס", "credit_card", "כרטיס אשראי", "vault-ref-2", -284650);
  db.prepare(
    `INSERT INTO linked_accounts (id, user_id, institution, account_type, display_name, vault_credential_id, balance_agorot, last_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(accIsracard, userId, "ישראכרט", "credit_card", "כרטיס אשראי נוסף", "vault-ref-3", -96200);

  // two months of transactions so recurring detection has monthly cadence to find
  const rows = [
    // June
    ["2026-06-19", -34290, "שופרסל דיל", accMax],
    ["2026-06-18", 1420000, "משכורת - חברת אורביט בע\"מ", accHapoalim],
    ["2026-06-17", -5490, "נטפליקס", accMax],
    ["2026-06-17", -98000, "ארנונה - עיריית תל אביב", accHapoalim],
    ["2026-06-16", -4500, "קופת חולים כללית", accMax],
    ["2026-06-13", -31200, "חברת חשמל", accHapoalim],
    ["2026-06-10", -1990, "ספוטיפיי", accMax],
    ["2026-06-01", -34900, "חדר כושר Holmes Place", accMax],
    ["2026-06-05", -21000, "ביטוח רכב - הראל", accHapoalim],
    ["2026-06-22", -4990, "מנוי עיתון הארץ", accMax],
    // July
    ["2026-07-19", -34290, "שופרסל דיל", accMax],
    ["2026-07-18", 1420000, "משכורת - חברת אורביט בע\"מ", accHapoalim],
    ["2026-07-18", -28000, "פז תחנת דלק", accMax],
    ["2026-07-17", -5490, "נטפליקס", accMax],
    ["2026-07-17", -98000, "ארנונה - עיריית תל אביב", accHapoalim],
    ["2026-07-16", -4500, "קופת חולים כללית", accMax],
    ["2026-07-15", -41900, "זארה - קניון עזריאלי", accIsracard],
    ["2026-07-14", -21750, "רמי לוי", accMax],
    ["2026-07-13", -31200, "חברת חשמל", accHapoalim],
    ["2026-07-12", -8900, "וולט - משלוח", accMax],
    ["2026-07-11", -6300, "גט טקסי", accMax],
    ["2026-07-10", -1990, "ספוטיפיי", accMax],
    ["2026-07-01", -34900, "חדר כושר Holmes Place", accMax],
    ["2026-07-05", -21000, "ביטוח רכב - הראל", accHapoalim],
    ["2026-07-22", -4990, "מנוי עיתון הארץ", accMax],
    // an installment purchase: 3/10 payments of a laptop
    ["2026-07-08", -45000, "איקאה", accIsracard, 3, 10],
  ];

  const insertTxn = db.prepare(
    `INSERT INTO transactions
     (id, linked_account_id, user_id, posted_date, amount_agorot, merchant_raw, merchant_clean,
      category_id, category_source, installment_number, installment_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const [date, amount, merchant, accountId, instNum, instTotal] of rows) {
    const { categoryId, source } = categorize(db, { merchantRaw: merchant, userId });
    insertTxn.run(
      id(), accountId, userId, date, amount, merchant, merchant.trim(),
      categoryId, source, instNum ?? null, instTotal ?? null
    );
  }

  // run recurring detection over the seeded history and persist results
  const detected = detectRecurring(db, userId);
  const flagged = flagPossiblyUnused(detected, ["חדר כושר Holmes Place", "מנוי עיתון הארץ"]);
  const insertRecurring = db.prepare(
    `INSERT INTO recurring_charges
     (id, user_id, merchant_clean, category_id, expected_amount_agorot, frequency, next_expected_date, confidence, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of flagged) {
    insertRecurring.run(
      id(), userId, r.merchant_clean, r.category_id, r.expected_amount_agorot,
      r.frequency, r.next_expected_date, r.confidence, r.flag === "unused" ? "flagged_unused" : "active"
    );
  }

  // budgets for July
  const budgetDefs = [
    ["מזון", 250000], ["חשבונות ודיור", 130000], ["קניות", 100000],
    ["בילויים ותרבות", 60000], ["תחבורה", 80000], ["בריאות", 40000],
  ];
  const insertBudget = db.prepare(
    `INSERT INTO budgets (id, user_id, category_id, month, limit_agorot) VALUES (?, ?, ?, ?, ?)`
  );
  for (const [cat, limit] of budgetDefs) {
    insertBudget.run(id(), userId, catId[cat], "2026-07", limit);
  }

  // savings goals
  const insertGoal = db.prepare(
    `INSERT INTO savings_goals (id, user_id, name, target_agorot, saved_agorot, target_date) VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertGoal.run(id(), userId, "חופשה ביוון", 1200000, 742000, "2027-06-30");
  insertGoal.run(id(), userId, "קרן חירום", 3000000, 2150000, null);

  console.log("Seed complete:", { userId, householdId, accHapoalim, accMax, accIsracard });
  return { userId, householdId };
}

if (require.main === module) seed();
module.exports = { seed };
