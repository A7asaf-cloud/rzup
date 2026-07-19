/**
 * Categorization engine.
 * - Checks user-specific overrides first (learned from past recategorizations).
 * - Falls back to system-wide merchant pattern rules.
 * - Falls back to a generic "אחר" (Other) category if nothing matches.
 *
 * This mirrors the "continuous learning" requirement: when a user recategorizes
 * a transaction, we store a merchant->category override so future transactions
 * from the same merchant are auto-categorized correctly.
 */

const SYSTEM_RULES = [
  { pattern: "שופרסל|רמי לוי|ויקטורי|יינות ביתן|מגה בעש|יוחננוף", category: "מזון" },
  { pattern: "פז |דלק|סונול|גט טקסי|אגד|רכבת ישראל|רב-?קו", category: "תחבורה" },
  { pattern: "נטפליקס|ספוטיפיי|וולט|סינמה סיטי|הוט(?!.*מובייל)|יס פלוס|דיסני", category: "בילויים ותרבות" },
  { pattern: "ארנונה|שכירות|ועד בית|משכנתא", category: "חשבונות ודיור" },
  { pattern: "קופת חולים|מכבי|כללית|לאומית|בית מרקחת|סופר-?פארם", category: "בריאות" },
  { pattern: "זארה|קסטרו|רנואר|איקאה|עזריאלי|קניון|פוקס", category: "קניות" },
  { pattern: "חברת חשמל|פרטנר|סלקום|הוט מובייל|בזק", category: "חשמל ואנרגיה" },
  { pattern: "משכורת|שכר עבודה|העברת שכר|החזר מס", category: "הכנסה" },
];

function normalizeMerchant(raw) {
  return raw.trim().replace(/\s+/g, " ");
}

function categorize(db, { merchantRaw, userId }) {
  const merchant = normalizeMerchant(merchantRaw);

  // 1. user-learned override (exact or partial merchant match)
  const override = db
    .prepare(
      `SELECT mcr.pattern, c.id as category_id, c.name_he
       FROM merchant_category_rules mcr
       JOIN categories c ON c.id = mcr.category_id
       WHERE mcr.is_user_override = 1 AND mcr.user_id = ?`
    )
    .all(userId)
    .find((r) => merchant.includes(r.pattern) || r.pattern.includes(merchant));

  if (override) {
    return { categoryName: override.name_he, categoryId: override.category_id, source: "user" };
  }

  // 2. system rule (regex over known merchant vocab)
  for (const rule of SYSTEM_RULES) {
    const re = new RegExp(rule.pattern, "i");
    if (re.test(merchant)) {
      const cat = db.prepare(`SELECT id FROM categories WHERE name_he = ?`).get(rule.category);
      if (cat) return { categoryName: rule.category, categoryId: cat.id, source: "auto" };
    }
  }

  // 3. fallback
  const other = db.prepare(`SELECT id FROM categories WHERE name_he = ?`).get("אחר");
  return { categoryName: "אחר", categoryId: other ? other.id : null, source: "auto" };
}

/**
 * Called when a user manually recategorizes a transaction.
 * Stores/updates a per-user override so future transactions from this
 * merchant are categorized correctly without asking again.
 */
function learnFromCorrection(db, { userId, merchantRaw, categoryId }) {
  const merchant = normalizeMerchant(merchantRaw);
  const existing = db
    .prepare(
      `SELECT id FROM merchant_category_rules WHERE user_id = ? AND pattern = ? AND is_user_override = 1`
    )
    .get(userId, merchant);

  if (existing) {
    db.prepare(`UPDATE merchant_category_rules SET category_id = ? WHERE id = ?`).run(
      categoryId,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO merchant_category_rules (pattern, category_id, is_user_override, user_id)
       VALUES (?, ?, 1, ?)`
    ).run(merchant, categoryId, userId);
  }
}

module.exports = { categorize, learnFromCorrection, normalizeMerchant, SYSTEM_RULES };
