/**
 * Cash flow forecast engine (spec section 4).
 *
 * opening_balance      = sum of current checking-account balances
 * projected_income     = avg of last 3 months' income transactions
 * known_fixed_expenses = sum of active recurring charges expected in the
 *                        remainder of the month + upcoming installments
 * projected_closing    = opening + projected_income - known_fixed_expenses
 * safe_to_spend_today  = (projected_closing - minimum_buffer) distributed
 *                        evenly over the remaining days of the month,
 *                        floored at 0.
 */

const MIN_BUFFER_AGOROT = 50000; // ₪500 safety buffer, configurable per user later

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function computeForecast(db, userId, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth(); // 0-indexed
  const today = refDate.getDate();
  const totalDays = daysInMonth(year, month);
  const remainingDays = Math.max(1, totalDays - today + 1);

  const openingRow = db
    .prepare(
      `SELECT COALESCE(SUM(balance_agorot), 0) as total
       FROM linked_accounts WHERE user_id = ? AND account_type = 'checking'`
    )
    .get(userId);
  const openingBalance = openingRow.total;

  // projected income: average of positive transactions from the last 90 days
  const incomeRow = db
    .prepare(
      `SELECT COALESCE(AVG(amount_agorot), 0) as avg_income
       FROM (
         SELECT amount_agorot FROM transactions
         WHERE user_id = ? AND amount_agorot > 0
         AND posted_date >= date('now', '-90 days')
       )`
    )
    .get(userId);
  const projectedIncome = Math.round(incomeRow.avg_income || 0);

  // known fixed expenses: active recurring charges due before month end
  const recurringRow = db
    .prepare(
      `SELECT COALESCE(SUM(expected_amount_agorot), 0) as total
       FROM recurring_charges
       WHERE user_id = ? AND status = 'active'`
    )
    .get(userId);

  // plus remaining installment payments due this month
  const installmentRow = db
    .prepare(
      `SELECT COALESCE(SUM(ABS(amount_agorot)), 0) as total
       FROM transactions
       WHERE user_id = ? AND installment_number IS NOT NULL
       AND installment_number < installment_total
       AND strftime('%Y-%m', posted_date) = ?`
    )
    .get(userId, `${year}-${String(month + 1).padStart(2, "0")}`);

  const knownFixedExpenses = recurringRow.total + installmentRow.total;

  const projectedClosingBalance = openingBalance + projectedIncome - knownFixedExpenses;

  const discretionaryPool = Math.max(0, projectedClosingBalance - MIN_BUFFER_AGOROT);
  const safeToSpendToday = Math.floor(discretionaryPool / remainingDays);

  return {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    opening_balance_agorot: openingBalance,
    projected_income_agorot: projectedIncome,
    known_fixed_expenses_agorot: knownFixedExpenses,
    projected_closing_balance_agorot: projectedClosingBalance,
    safe_to_spend_today_agorot: safeToSpendToday,
    remaining_days: remainingDays,
  };
}

module.exports = { computeForecast, MIN_BUFFER_AGOROT };
