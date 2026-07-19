/**
 * Recurring-charge detection.
 * Groups a user's expense transactions by merchant, and flags a merchant as
 * "recurring" if it appears >=2 times at a roughly monthly cadence with a
 * stable amount (within 5% tolerance). This is the auto-detection engine
 * described in the spec (section 3): frequency + amount pattern matching.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / DAY_MS;
}

function detectRecurring(db, userId) {
  const txns = db
    .prepare(
      `SELECT * FROM transactions
       WHERE user_id = ? AND amount_agorot < 0
       ORDER BY merchant_clean, posted_date`
    )
    .all(userId);

  const byMerchant = {};
  for (const t of txns) {
    (byMerchant[t.merchant_clean] = byMerchant[t.merchant_clean] || []).push(t);
  }

  const results = [];
  for (const [merchant, list] of Object.entries(byMerchant)) {
    if (list.length < 2) continue;

    const amounts = list.map((t) => Math.abs(t.amount_agorot));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stableAmount = amounts.every((a) => Math.abs(a - avg) / avg < 0.05);

    const gaps = [];
    for (let i = 1; i < list.length; i++) {
      gaps.push(daysBetween(list[i - 1].posted_date, list[i].posted_date));
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const looksMonthly = avgGap >= 25 && avgGap <= 35;
    const looksWeekly = avgGap >= 6 && avgGap <= 8;

    if (stableAmount && (looksMonthly || looksWeekly)) {
      const last = list[list.length - 1];
      const frequency = looksMonthly ? "monthly" : "weekly";
      const nextDate = new Date(last.posted_date);
      nextDate.setDate(nextDate.getDate() + Math.round(avgGap));

      results.push({
        merchant_clean: merchant,
        category_id: last.category_id,
        expected_amount_agorot: Math.round(avg),
        frequency,
        next_expected_date: nextDate.toISOString().slice(0, 10),
        confidence: Math.min(0.99, 0.6 + list.length * 0.1),
      });
    }
  }
  return results;
}

/** Very simple "looks unused" heuristic for the savings-recommendation feature:
 *  flags entertainment/subscription-type recurring charges that a caller can
 *  cross-reference against a manual "confirmed unused" list from the user,
 *  or (in this mock) a fixed watch-list of subscription categories. */
function flagPossiblyUnused(recurring, unusedWatchlist = []) {
  return recurring.map((r) => ({
    ...r,
    flag: unusedWatchlist.includes(r.merchant_clean) ? "unused" : null,
  }));
}

module.exports = { detectRecurring, flagPossiblyUnused };
