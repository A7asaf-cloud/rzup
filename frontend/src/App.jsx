import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, PiggyBank,
  RefreshCw, Landmark, CreditCard, ChevronLeft, Search, Bell,
  Plane, ShoppingBag, Utensils, Car, Zap, HeartPulse, Film, Home as HomeIcon,
  LayoutDashboard, ListChecks, BellRing, ChevronDown, Check, X, ShieldAlert
} from "lucide-react";

/* ---------------------------------------------------------------
   פנקס — Personal finance prototype (mock data, no live bank calls)
   Design: ledger / bank-passbook heritage, ink + paper palette
----------------------------------------------------------------*/

const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:4000";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Heebo:wght@300;400;500;600;700;800&display=swap');
`;

const COLORS = {
  ink: "#1B2438",
  inkSoft: "#3A4560",
  paper: "#EEF0EA",
  paperDeep: "#E2E5DC",
  line: "#D3D6CC",
  green: "#1F7A5C",
  greenSoft: "#DCEAE2",
  brick: "#B8503F",
  brickSoft: "#F3DEDA",
  brass: "#B08D3F",
  brassSoft: "#F1E7CF",
};

const CATEGORY_META = {
  "מזון": { color: "#1F7A5C", icon: Utensils },
  "תחבורה": { color: "#3A6EA5", icon: Car },
  "בילויים ותרבות": { color: "#B08D3F", icon: Film },
  "חשבונות ודיור": { color: "#6B4E9C", icon: HomeIcon },
  "בריאות": { color: "#B8503F", icon: HeartPulse },
  "קניות": { color: "#C77B3C", icon: ShoppingBag },
  "חשמל ואנרגיה": { color: "#3A9AA0", icon: Zap },
};

const money = (agorot, opts = {}) => {
  const shekels = agorot / 100;
  const sign = shekels < 0 ? "-" : "";
  const abs = Math.abs(shekels);
  return `${sign}₪${abs.toLocaleString("he-IL", {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0,
  })}`;
};

/* ---------------- mock data ---------------- */

const ACCOUNTS = [
  { id: 1, institution: "בנק הפועלים", type: "עו״ש", icon: Landmark, balance: 812340, color: "#B8322A" },
  { id: 2, institution: "מקס", type: "אשראי", icon: CreditCard, balance: -284650, color: "#1B2438" },
  { id: 3, institution: "ישראכרט", type: "אשראי", icon: CreditCard, balance: -96200, color: "#3A6EA5" },
];

const TRANSACTIONS = [
  { id: 1, date: "19.07", merchant: "שופרסל דיל", category: "מזון", amount: -34290 },
  { id: 2, date: "18.07", merchant: "משכורת - חברת אורביט בע״מ", category: "הכנסה", amount: 1420000 },
  { id: 3, date: "18.07", merchant: "פז תחנת דלק", category: "תחבורה", amount: -28000 },
  { id: 4, date: "17.07", merchant: "נטפליקס", category: "בילויים ותרבות", amount: -5490 },
  { id: 5, date: "17.07", merchant: "ארנונה - עיריית תל אביב", category: "חשבונות ודיור", amount: -98000 },
  { id: 6, date: "16.07", merchant: "קופת חולים כללית", category: "בריאות", amount: -4500 },
  { id: 7, date: "15.07", merchant: "זארה - קניון עזריאלי", category: "קניות", amount: -41900 },
  { id: 8, date: "14.07", merchant: "רמי לוי", category: "מזון", amount: -21750 },
  { id: 9, date: "13.07", merchant: "חברת חשמל", category: "חשמל ואנרגיה", amount: -31200 },
  { id: 10, date: "12.07", merchant: "וולט - משלוח", category: "בילויים ותרבות", amount: -8900 },
  { id: 11, date: "11.07", merchant: "גט טקסי", category: "תחבורה", amount: -6300 },
  { id: 12, date: "10.07", merchant: "ספוטיפיי", category: "בילויים ותרבות", amount: -1990 },
];

const RECURRING = [
  { id: 1, merchant: "נטפליקס", amount: 5490, frequency: "חודשי", next: "17.08", flag: null },
  { id: 2, merchant: "ספוטיפיי פרימיום", amount: 1990, frequency: "חודשי", next: "10.08", flag: null },
  { id: 3, merchant: "חדר כושר Holmes Place", amount: 34900, frequency: "חודשי", next: "01.08", flag: "unused" },
  { id: 4, merchant: "ביטוח רכב - הראל", amount: 21000, frequency: "חודשי", next: "05.08", flag: null },
  { id: 5, merchant: "מנוי עיתון הארץ", amount: 4990, frequency: "חודשי", next: "22.08", flag: "unused" },
];

const FORECAST = [
  { day: "1", balance: 9800 }, { day: "4", balance: 8600 }, { day: "7", balance: 11200 },
  { day: "10", balance: 9400 }, { day: "13", balance: 8100 }, { day: "16", balance: 8500 },
  { day: "19", balance: 8123, today: true }, { day: "22", balance: 21500, projected: true },
  { day: "25", balance: 19800, projected: true }, { day: "28", balance: 17200, projected: true },
  { day: "31", balance: 16400, projected: true },
];

const CATEGORY_TOTALS = [
  { name: "מזון", value: 5604 },
  { name: "חשבונות ודיור", value: 9800 },
  { name: "קניות", value: 4190 },
  { name: "בילויים ותרבות", value: 1638 },
  { name: "תחבורה", value: 1211 },
  { name: "חשמל ואנרגיה", value: 3120 },
  { name: "בריאות", value: 450 },
];

const GOALS = [
  { id: 1, name: "חופשה ביוון", target: 1200000, saved: 742000, date: "יוני 2027", icon: Plane },
  { id: 2, name: "קרן חירום", target: 3000000, saved: 2150000, date: "ללא יעד", icon: PiggyBank },
];

const BUDGETS = [
  { category: "מזון", limit: 250000, spent: 213400 },
  { category: "חשבונות ודיור", limit: 130000, spent: 129800 },
  { category: "קניות", limit: 100000, spent: 118900 },
  { category: "בילויים ותרבות", limit: 60000, spent: 16380 },
  { category: "תחבורה", limit: 80000, spent: 34300 },
  { category: "בריאות", limit: 40000, spent: 4500 },
];

const ALERTS = [
  { id: 1, kind: "overrun", title: "חריגה מתקציב: קניות", detail: "עברת את התקציב החודשי ב-₪189", date: "היום, 09:12" },
  { id: 2, kind: "warning", title: "מתקרב לתקציב: חשבונות ודיור", detail: "98% מהתקציב החודשי נוצל", date: "אתמול, 18:40" },
  { id: 3, kind: "unusual", title: "עסקה חריגה זוהתה", detail: "זארה — סכום גבוה משמעותית מהרגיל בקטגוריה זו", date: "15.07, 20:03" },
  { id: 4, kind: "subscription", title: "2 מנויים שאולי אינם בשימוש", detail: "Holmes Place, הארץ — יחד ₪39.90 לחודש", date: "12.07, 08:00" },
  { id: 5, kind: "low_balance", title: "יתרה נמוכה צפויה", detail: "לפי התחזית, היתרה עלולה לרדת מתחת ל-₪500 ב-28.07", date: "10.07, 07:30" },
];

/* ---------------- small building blocks ---------------- */

function StampBadge() {
  return (
    <div
      style={{
        border: `2px solid ${COLORS.brass}`,
        borderRadius: "50%",
        width: 84,
        height: 84,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: "rotate(-8deg)",
        color: COLORS.brass,
        flexShrink: 0,
        position: "relative",
        opacity: 0.85,
      }}
    >
      <div style={{
        position: "absolute", inset: 4, border: `1px solid ${COLORS.brass}`, borderRadius: "50%",
      }} />
      <span style={{ fontFamily: "'Heebo'", fontWeight: 800, fontSize: 11, textAlign: "center", lineHeight: 1.15 }}>
        מאושר<br />היום
      </span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Heebo'", fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
      color: COLORS.inkSoft, textTransform: "none", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ width: 18, height: 1, background: COLORS.brass, display: "inline-block" }} />
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: COLORS.ink, color: COLORS.paper, padding: "8px 12px",
      borderRadius: 6, fontFamily: "'Heebo'", fontSize: 12, direction: "rtl",
    }}>
      <div style={{ opacity: 0.6, marginBottom: 2 }}>{`יום ${label}`}</div>
      <div style={{ fontWeight: 700 }}>{money(payload[0].value * 100)}</div>
    </div>
  );
}

/* ---------------- main app ---------------- */

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState(TRANSACTIONS);
  const [accounts, setAccounts] = useState(ACCOUNTS);
  const [recurring, setRecurring] = useState(RECURRING);
  const [budgets, setBudgets] = useState(BUDGETS);
  const [alerts, setAlerts] = useState(ALERTS);
  const [goals, setGoals] = useState(GOALS);
  const [forecast, setForecast] = useState(null);
  const [categories, setCategories] = useState([]); // [{id, name_he}]
  const [openCatMenu, setOpenCatMenu] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const [accRes, txRes, catRes, recRes, budRes, alertRes, goalRes, fcRes] = await Promise.all([
          fetch(`${API_BASE}/api/accounts`),
          fetch(`${API_BASE}/api/transactions?limit=30`),
          fetch(`${API_BASE}/api/categories`),
          fetch(`${API_BASE}/api/recurring`),
          fetch(`${API_BASE}/api/budgets`),
          fetch(`${API_BASE}/api/alerts`),
          fetch(`${API_BASE}/api/goals`),
          fetch(`${API_BASE}/api/forecast`),
        ]);
        if (!accRes.ok) throw new Error("API not reachable");

        const [accData, txData, catData, recData, budData, alertData, goalData, fcData] = await Promise.all([
          accRes.json(), txRes.json(), catRes.json(), recRes.json(),
          budRes.json(), alertRes.json(), goalRes.json(), fcRes.json(),
        ]);
        if (cancelled) return;

        setAccounts(accData.map((a) => ({
          id: a.id, institution: a.institution,
          icon: a.account_type === "checking" ? Landmark : CreditCard,
          balance: a.balance_agorot,
          color: a.institution.includes("הפועלים") ? "#B8322A" : a.institution.includes("מקס") ? "#1B2438" : "#3A6EA5",
        })));
        setTransactions(txData.map((t) => ({
          id: t.id, date: t.posted_date.slice(5).split("-").reverse().join("."),
          merchant: t.merchant_raw, category: t.category_name || "אחר",
          amount: t.amount_agorot, source: t.category_source,
        })));
        setCategories(catData.filter((c) => c.kind === "expense"));
        setRecurring(recData.map((r) => ({
          id: r.id, merchant: r.merchant_clean, amount: r.expected_amount_agorot,
          frequency: r.frequency === "monthly" ? "חודשי" : "שבועי",
          next: r.next_expected_date?.slice(5).split("-").reverse().join(".") || "",
          flag: r.status === "flagged_unused" ? "unused" : null,
        })));
        setBudgets(budData.map((b) => ({ category: b.category_name, limit: b.limit_agorot, spent: b.spent_agorot })));
        setAlerts(alertData.map((a, i) => ({ id: i, kind: a.kind, title: a.title, detail: a.detail, date: "" })));
        setGoals(goalData.map((g) => ({
          id: g.id, name: g.name, target: g.target_agorot, saved: g.saved_agorot,
          date: g.target_date ? g.target_date.slice(0, 7) : "ללא יעד",
          icon: g.name.includes("חופש") ? Plane : PiggyBank,
        })));
        setForecast(fcData);
        setConnected(true);
      } catch (e) {
        // backend not running — stay on mock data so the UI is still explorable
        setConnected(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  const recategorize = async (txId, newCategoryName) => {
    setOpenCatMenu(null);
    const cat = categories.find((c) => c.name_he === newCategoryName);
    setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, category: newCategoryName, source: "user" } : t)));
    if (!connected || !cat) return; // mock mode: local-only update
    try {
      await fetch(`${API_BASE}/api/transactions/${txId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: cat.id }),
      });
    } catch (e) { /* offline — local state already updated */ }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const safeToday = forecast ? forecast.safe_to_spend_today_agorot : 812300;
  const forecastClosing = forecast ? forecast.projected_closing_balance_agorot : 1640000;
  const flaggedRecurring = recurring.filter((r) => r.flag === "unused");

  const NAV = [
    { id: "dashboard", label: "לוח בקרה", icon: LayoutDashboard },
    { id: "budgets", label: "תקציבים", icon: ListChecks },
    { id: "alerts", label: "התראות", icon: BellRing },
  ];

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: COLORS.paper,
      fontFamily: "'Heebo', sans-serif",
      color: COLORS.ink,
    }}>
      <style>{FONT_IMPORT}{`
        * { box-sizing: border-box; }
        .num { font-variant-numeric: tabular-nums; }
        .ledger-row { transition: background 0.15s ease; }
        .ledger-row:hover { background: ${COLORS.paperDeep}; }
        ::selection { background: ${COLORS.brassSoft}; }
      `}</style>

      {/* header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px", borderBottom: `1px solid ${COLORS.line}`,
        maxWidth: 980, margin: "0 auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, background: COLORS.ink,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Wallet size={18} color={COLORS.brass} />
          </div>
          <span style={{ fontFamily: "'Frank Ruhl Libre'", fontWeight: 700, fontSize: 22 }}>פנקס</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
            background: connected ? COLORS.greenSoft : COLORS.brassSoft,
            color: connected ? COLORS.green : COLORS.brass,
          }}>
            {connected ? "מחובר ל-API" : "נתוני דוגמה (API לא זמין)"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Search size={18} color={COLORS.inkSoft} />
          <div style={{ position: "relative" }}>
            <Bell size={18} color={COLORS.inkSoft} />
            <span style={{
              position: "absolute", top: -3, left: -3, width: 7, height: 7,
              borderRadius: "50%", background: COLORS.brick,
            }} />
          </div>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: COLORS.brassSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: COLORS.brass,
          }}>נכ</div>
        </div>
      </header>

      <nav style={{
        display: "flex", gap: 4, maxWidth: 980, margin: "0 auto", padding: "0 24px",
        borderBottom: `1px solid ${COLORS.line}`,
      }}>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          const count = n.id === "alerts" ? alerts.length : null;
          return (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "13px 6px", marginInlineEnd: 22,
                background: "none", border: "none", cursor: "pointer",
                fontFamily: "'Heebo'", fontSize: 13.5, fontWeight: 600,
                color: active ? COLORS.ink : COLORS.inkSoft,
                borderBottom: active ? `2px solid ${COLORS.brass}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <Icon size={15} />
              {n.label}
              {count ? (
                <span style={{
                  background: COLORS.brickSoft, color: COLORS.brick, fontSize: 10.5,
                  fontWeight: 700, borderRadius: 999, padding: "1px 6px",
                }}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 60px" }}>
      {tab === "dashboard" && (
      <>
        <section style={{
          background: COLORS.ink, borderRadius: 18, padding: "28px 30px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 20, marginBottom: 22, position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0, opacity: 0.06,
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 27px, ${COLORS.paper} 28px)`,
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ color: "#9AA3BD", fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
              בטוח להוציא היום, בהתחשב בהתחייבויות החודש
            </div>
            <div className="num" style={{
              fontFamily: "'Frank Ruhl Libre'", fontWeight: 900, fontSize: 44,
              color: COLORS.paper, lineHeight: 1,
            }}>
              {money(safeToday)}
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ color: "#C9CEDE", fontSize: 12.5 }}>
                יתרת חשבונות: <span className="num" style={{ color: COLORS.paper, fontWeight: 600 }}>{money(totalBalance)}</span>
              </div>
              <div style={{ color: "#C9CEDE", fontSize: 12.5 }}>
                תחזית סוף חודש: <span className="num" style={{ color: "#7FCBA6", fontWeight: 600 }}>{money(forecastClosing)}</span>
              </div>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1 }}>
            <StampBadge />
          </div>
        </section>

        {/* linked accounts strip */}
        <section style={{ display: "flex", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
          {accounts.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.id} style={{
                flex: "1 1 220px", background: "#fff", border: `1px solid ${COLORS.line}`,
                borderRadius: 12, padding: "14px 16px", display: "flex",
                alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 9, background: a.color + "18",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={17} color={a.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 500 }}>{a.institution}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700, color: a.balance < 0 ? COLORS.brick : COLORS.ink }}>
                    {money(a.balance)}
                  </div>
                </div>
                <RefreshCw size={13} color={COLORS.line} />
              </div>
            );
          })}
        </section>

        {/* two-column: forecast + categories */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, marginBottom: 30 }}>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 22 }}>
            <SectionLabel>תזרים מזומנים — יולי 2026</SectionLabel>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={FORECAST} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.green} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontFamily: "Heebo", fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontFamily: "Heebo", fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} width={0} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="balance" stroke={COLORS.green} strokeWidth={2.5} fill="url(#fc)" />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: COLORS.inkSoft }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.green }} /> בפועל
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: COLORS.inkSoft }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.green, opacity: 0.4 }} /> תחזית
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 22 }}>
            <SectionLabel>הוצאות לפי קטגוריה</SectionLabel>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie
                  data={CATEGORY_TOTALS} dataKey="value" nameKey="name"
                  innerRadius={40} outerRadius={65} paddingAngle={2}
                >
                  {CATEGORY_TOTALS.map((c, i) => (
                    <Cell key={i} fill={CATEGORY_META[c.name]?.color || COLORS.brass} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => money(v * 100)} contentStyle={{ fontFamily: "Heebo", fontSize: 12, direction: "rtl" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginTop: 8 }}>
              {CATEGORY_TOTALS.slice(0, 6).map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_META[c.name]?.color, flexShrink: 0 }} />
                  <span style={{ color: COLORS.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* recurring / subscriptions with flags */}
        <section style={{ marginBottom: 30 }}>
          <SectionLabel>חיובים קבועים ומנויים</SectionLabel>
          {flaggedRecurring.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, background: COLORS.brickSoft,
              color: COLORS.brick, padding: "10px 14px", borderRadius: 10, fontSize: 12.5,
              marginBottom: 12, fontWeight: 500,
            }}>
              <AlertTriangle size={15} />
              זיהינו {flaggedRecurring.length} מנויים שנראים לא בשימוש — כדאי לבדוק
            </div>
          )}
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
            {recurring.map((r, i) => (
              <div key={r.id} className="ledger-row" style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "13px 18px", borderBottom: i < recurring.length - 1 ? `1px solid ${COLORS.line}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{r.merchant}</span>
                  {r.flag === "unused" && (
                    <span style={{
                      fontSize: 10.5, background: COLORS.brickSoft, color: COLORS.brick,
                      padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                    }}>ייתכן שלא בשימוש</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <span style={{ fontSize: 12, color: COLORS.inkSoft }}>{r.frequency} · הבא: {r.next}</span>
                  <span className="num" style={{ fontSize: 13.5, fontWeight: 700 }}>{money(r.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* savings goals */}
        <section style={{ marginBottom: 30 }}>
          <SectionLabel>יעדי חיסכון</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {goals.map((g) => {
              const Icon = g.icon;
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <div key={g.id} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, background: COLORS.brassSoft,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon size={16} color={COLORS.brass} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>יעד: {g.date}</div>
                    </div>
                  </div>
                  <div style={{ height: 7, background: COLORS.paperDeep, borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: COLORS.green, borderRadius: 999 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span className="num" style={{ fontWeight: 700 }}>{money(g.saved)}</span>
                    <span style={{ color: COLORS.inkSoft }} className="num">מתוך {money(g.target)} · {pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* transactions ledger */}
        <section>
          <SectionLabel>תנועות אחרונות · לחיצה על הקטגוריה מאפשרת לשנות אותה</SectionLabel>
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "visible" }}>
            {transactions.map((t, i) => {
              const meta = CATEGORY_META[t.category];
              const Icon = meta?.icon || Wallet;
              const isIncome = t.amount > 0;
              const menuOpen = openCatMenu === t.id;
              return (
                <div key={t.id} className="ledger-row" style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 18px", borderBottom: i < transactions.length - 1 ? `1px solid ${COLORS.line}` : "none",
                  position: "relative",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: isIncome ? COLORS.greenSoft : (meta?.color || COLORS.brass) + "18",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {isIncome ? <TrendingUp size={14} color={COLORS.green} /> : <Icon size={14} color={meta?.color || COLORS.brass} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.merchant}</div>
                      {isIncome ? (
                        <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{t.category} · {t.date}</div>
                      ) : (
                        <button
                          onClick={() => setOpenCatMenu(menuOpen ? null : t.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 3, background: "none",
                            border: "none", cursor: "pointer", padding: 0, fontFamily: "'Heebo'",
                            fontSize: 11.5, color: COLORS.inkSoft,
                          }}
                        >
                          {t.category} · {t.date}
                          {t.source === "user" && <Check size={11} color={COLORS.green} style={{ marginInlineStart: 2 }} />}
                          <ChevronDown size={11} />
                        </button>
                      )}
                      {menuOpen && (
                        <div style={{
                          position: "absolute", zIndex: 10, top: "100%", right: 44, marginTop: 4,
                          background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10,
                          boxShadow: "0 8px 24px rgba(27,36,56,0.14)", padding: 6, minWidth: 170,
                        }}>
                          {Object.keys(CATEGORY_META).map((c) => (
                            <div
                              key={c}
                              onClick={() => recategorize(t.id, c)}
                              style={{
                                padding: "7px 10px", borderRadius: 6, fontSize: 12.5, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 8,
                                background: c === t.category ? COLORS.paperDeep : "transparent",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.paper)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = c === t.category ? COLORS.paperDeep : "transparent")}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_META[c].color }} />
                              {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="num" style={{
                    fontSize: 13.5, fontWeight: 700,
                    color: isIncome ? COLORS.green : COLORS.ink,
                  }}>
                    {isIncome ? "+" : ""}{money(t.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </>
      )}

      {tab === "budgets" && (
        <section>
          <SectionLabel>תקציבים חודשיים · יולי 2026</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {budgets.map((b) => {
              const meta = CATEGORY_META[b.category];
              const Icon = meta?.icon || Wallet;
              const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
              const over = b.spent > b.limit;
              const near = !over && pct >= 90;
              return (
                <div key={b.category} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: meta.color + "18",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={15} color={meta.color} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{b.category}</span>
                      {over && (
                        <span style={{
                          fontSize: 10.5, background: COLORS.brickSoft, color: COLORS.brick,
                          padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                        }}>חריגה</span>
                      )}
                      {near && (
                        <span style={{
                          fontSize: 10.5, background: COLORS.brassSoft, color: COLORS.brass,
                          padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                        }}>מתקרב לגבול</span>
                      )}
                    </div>
                    <span className="num" style={{ fontSize: 13, color: COLORS.inkSoft }}>
                      <b style={{ color: over ? COLORS.brick : COLORS.ink }}>{money(b.spent)}</b> מתוך {money(b.limit)}
                    </span>
                  </div>
                  <div style={{ height: 8, background: COLORS.paperDeep, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 999,
                      background: over ? COLORS.brick : near ? COLORS.brass : COLORS.green,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "alerts" && (
        <section>
          <SectionLabel>התראות אחרונות</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.map((a) => {
              const ICONS = {
                overrun: { icon: AlertTriangle, color: COLORS.brick, bg: COLORS.brickSoft },
                warning: { icon: ShieldAlert, color: COLORS.brass, bg: COLORS.brassSoft },
                unusual: { icon: TrendingUp, color: COLORS.brick, bg: COLORS.brickSoft },
                subscription: { icon: RefreshCw, color: COLORS.brass, bg: COLORS.brassSoft },
                low_balance: { icon: Wallet, color: COLORS.brick, bg: COLORS.brickSoft },
              };
              const conf = ICONS[a.kind];
              const Icon = conf.icon;
              return (
                <div key={a.id} style={{
                  background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14,
                  padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 9, background: conf.bg,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Icon size={16} color={conf.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 5 }}>{a.detail}</div>
                    <div style={{ fontSize: 11, color: COLORS.line, fontWeight: 600 }}>{a.date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

        <div style={{ textAlign: "center", marginTop: 30, fontSize: 11, color: COLORS.inkSoft }}>
          נתוני דוגמה בלבד · אין חיבור בפועל לחשבונות בנק
        </div>
      </main>
    </div>
  );
}
