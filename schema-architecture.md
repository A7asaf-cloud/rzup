# פנקס (Pinkas) — Architecture & Data Model

Working name: **פנקס** ("Pinkas" — Hebrew for ledger/passbook, evoking the old Israeli bank savings booklet). Swap freely.

## 1. System Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React /     │────▶│  API Gateway      │────▶│  App Server          │
│  React Native│     │  (auth, rate      │     │  Node.js/TS(Fastify) │
│  (RTL, He)   │     │   limit, 2FA)     │     │  or Python/FastAPI   │
└─────────────┘     └──────────────────┘     └───────────┬─────────┘
                                                            │
                     ┌──────────────────────────────────────┼──────────────────┐
                     ▼                                      ▼                  ▼
         ┌────────────────────┐              ┌────────────────────┐  ┌─────────────────┐
         │  Categorization &   │              │  Forecast Engine    │  │  Notification /  │
         │  Recurring-charge    │              │  (cron / event-     │  │  Alert Service    │
         │  Detection Worker    │              │  driven, per-user)  │  │                  │
         └─────────┬───────────┘              └──────────┬──────────┘  └─────────┬────────┘
                     │                                     │                      │
                     └─────────────────┬───────────────────┴──────────────────────┘
                                        ▼
                              ┌───────────────────┐
                              │   PostgreSQL        │
                              └───────────────────┘
                                        ▲
                     ┌──────────────────┴──────────────────┐
                     │      Credential Vault (isolated,      │
                     │      encrypted, separate service)     │
                     └──────────────────┬──────────────────┘
                                        ▼
                     ┌───────────────────────────────────────┐
                     │  Bank Connector Layer                    │
                     │  - Licensed Open Banking provider (pref) │
                     │  - israeli-bank-scrapers (fallback)      │
                     └───────────────────────────────────────┘
```

Key principle: the **credential vault and bank-connector layer are isolated** from the main app server — a compromise of the app server should not expose bank credentials. Scraper/connector jobs run in a separate sandboxed worker with no direct internet egress beyond the specific bank endpoints.

## 2. Database Schema (PostgreSQL)

```sql
-- Users & auth
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  full_name         TEXT,
  locale            TEXT DEFAULT 'he-IL',
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret  TEXT,          -- encrypted at rest
  household_id      UUID REFERENCES households(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Linked accounts (credentials NEVER live here — only a vault reference)
CREATE TABLE linked_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
  institution        TEXT NOT NULL,        -- 'hapoalim' | 'leumi' | 'isracard' | 'cal' | 'max' ...
  account_type       TEXT NOT NULL,        -- 'checking' | 'credit_card'
  display_name       TEXT,
  vault_credential_id TEXT NOT NULL,       -- opaque pointer into isolated vault, not a secret itself
  connection_status  TEXT DEFAULT 'active',-- active | error | reauth_required
  last_synced_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Categories (system defaults + user-created)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL = system default
  name_he     TEXT NOT NULL,
  icon        TEXT,
  kind        TEXT NOT NULL,   -- 'expense' | 'income'
  parent_id   UUID REFERENCES categories(id)
);

-- Transactions
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linked_account_id UUID REFERENCES linked_accounts(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  posted_date      DATE NOT NULL,
  amount_agorot    BIGINT NOT NULL,      -- store as integer agorot, never float
  currency         TEXT DEFAULT 'ILS',
  merchant_raw     TEXT,                 -- original description from bank
  merchant_clean   TEXT,                 -- normalized name
  category_id      UUID REFERENCES categories(id),
  category_source  TEXT DEFAULT 'auto',  -- 'auto' | 'user'
  status            TEXT DEFAULT 'completed', -- 'completed' | 'pending'
  installment_info  JSONB,               -- {plan_total, installment_number, remaining}
  is_recurring_id    UUID REFERENCES recurring_charges(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (linked_account_id, posted_date, amount_agorot, merchant_raw)
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, posted_date DESC);

-- Recurring charges / subscriptions (auto-detected)
CREATE TABLE recurring_charges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  merchant_clean  TEXT NOT NULL,
  category_id     UUID REFERENCES categories(id),
  expected_amount_agorot BIGINT,
  frequency        TEXT,   -- 'monthly' | 'weekly' | 'yearly'
  next_expected_date DATE,
  confidence        NUMERIC(3,2), -- 0-1 detection confidence
  status             TEXT DEFAULT 'active', -- active | cancelled_by_user | flagged_unused
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Budgets
CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES categories(id),
  month        DATE NOT NULL,       -- first-of-month
  limit_agorot BIGINT NOT NULL,
  UNIQUE (user_id, category_id, month)
);

-- Cash flow forecast (materialized, recomputed on new tx / nightly)
CREATE TABLE cashflow_forecast (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  month                 DATE NOT NULL,
  opening_balance_agorot BIGINT,
  projected_income_agorot BIGINT,
  known_fixed_expenses_agorot BIGINT,
  projected_closing_balance_agorot BIGINT,
  safe_to_spend_today_agorot BIGINT,
  computed_at            TIMESTAMPTZ DEFAULT now()
);

-- Savings goals
CREATE TABLE savings_goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  target_agorot  BIGINT NOT NULL,
  saved_agorot   BIGINT DEFAULT 0,
  target_date    DATE,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Audit log (append-only, required for financial data access)
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  actor       TEXT,        -- 'user' | 'system' | 'admin:<id>'
  action      TEXT NOT NULL,
  resource    TEXT,
  ip_address  INET,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

Notes:
- Money stored as integer **agorot** (1/100 shekel), never floating point.
- `vault_credential_id` in `linked_accounts` is a pointer only — actual encrypted credentials live in a separate vault service/DB with its own access controls and its own audit trail.
- `audit_log` is append-only (revoke UPDATE/DELETE grants at the DB role level) to satisfy the audit requirement under Amendment 13 of the Privacy Protection Law.

## 3. Security Checklist

- TLS 1.2+ everywhere; AES-256 at rest for `linked_accounts`, vault DB, and any exported reports.
- Vault service on a separate network segment/VPC, reachable only by the connector workers — not by the public API.
- 2FA (TOTP) mandatory before a bank/card can be linked.
- Field-level encryption for `two_factor_secret`, vault credential blobs.
- Rate-limit and alert on abnormal audit_log patterns (e.g. bulk export, repeated failed 2FA).
- Data retention & deletion flow to support user-initiated account/data erasure (Amendment 13 rights).

## 4. Phased Build (maps to the prototype)

1. **MVP** — one linked account (mocked), transaction list, auto-categorization → *this is what the prototype demonstrates with mock data*
2. Cash flow forecast engine + "safe to spend today"
3. Multiple accounts/cards, installment tracking
4. Budgets + alerts
5. Savings goals + smart recommendations (duplicate/unused subscription detection)
6. React Native mobile app, household sharing
