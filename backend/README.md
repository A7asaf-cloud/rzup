# פנקס (Pinkas) — Backend

A runnable implementation of the architecture in `schema-architecture.md`, using
SQLite instead of Postgres so it runs anywhere with no external setup. All bank
data is **mocked/seeded** — there is no live connection to any bank or card
company. Wiring in a real connector (a licensed Open Banking provider, or
`israeli-bank-scrapers`) means implementing `POST /api/accounts/:id/sync`
against that provider instead of the mock stub, and writing results through
the same `transactions` table.

## What's real vs. mocked

| Piece | Status |
|---|---|
| DB schema, money-as-integer-agorot, audit log | Real, runs against SQLite |
| Auto-categorization engine (rules + per-user learning) | Real logic, runs on the seed data |
| Recurring-charge detection (frequency + amount pattern matching) | Real logic, runs on the seed data |
| Cash-flow forecast engine ("safe to spend today") | Real logic, runs on the seed data |
| Bank/card connections | **Mocked.** Seed script inserts sample accounts/transactions; `/sync` is a stub |
| Auth / 2FA | **Mocked.** Single seeded user, no login flow |

## Run it

```bash
npm install
npm run seed    # creates pinkas.db and populates mock data
npm start        # starts the API on http://localhost:4000
```

## Endpoints

- `GET /api/accounts` — linked accounts and balances
- `POST /api/accounts/:id/sync` — mock refresh (stub, no live bank call)
- `GET /api/categories`
- `GET /api/transactions?limit=50`
- `PATCH /api/transactions/:id/category` — body `{ "category_id": "..." }`, also feeds the learning engine
- `GET /api/recurring` — detected recurring charges/subscriptions
- `POST /api/recurring/detect` — re-run detection over current transaction history
- `GET /api/budgets?month=2026-07`
- `GET /api/forecast` — opening balance, projected income/expenses, safe-to-spend-today
- `GET /api/goals`
- `GET /api/alerts` — derived from budgets, recurring flags, and the forecast

## Files

```
db/schema.sql        SQLite schema (simplified from schema-architecture.md)
src/db.js            connection + auto-init
src/categorize.js     auto-categorization + learning-from-correction
src/recurring.js       recurring-charge detection
src/forecast.js         cash-flow forecast engine
src/seed.js             mock data (2 months of transactions, 3 accounts)
src/server.js           Express API
```
