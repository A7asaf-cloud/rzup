-- Simplified SQLite version of the Postgres schema in schema-architecture.md
-- Money stored as integer agorot (1/100 shekel). No floats.

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  household_id TEXT REFERENCES households(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS linked_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  institution TEXT NOT NULL,
  account_type TEXT NOT NULL,      -- checking | credit_card
  display_name TEXT,
  vault_credential_id TEXT,        -- opaque pointer only, never a real secret
  connection_status TEXT DEFAULT 'active',
  balance_agorot INTEGER DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),  -- NULL = system default
  name_he TEXT NOT NULL,
  kind TEXT NOT NULL                   -- expense | income
);

CREATE TABLE IF NOT EXISTS merchant_category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,     -- substring/regex matched against merchant_raw
  category_id TEXT REFERENCES categories(id),
  is_user_override INTEGER DEFAULT 0,
  user_id TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  linked_account_id TEXT REFERENCES linked_accounts(id),
  user_id TEXT REFERENCES users(id),
  posted_date TEXT NOT NULL,
  amount_agorot INTEGER NOT NULL,
  merchant_raw TEXT,
  merchant_clean TEXT,
  category_id TEXT REFERENCES categories(id),
  category_source TEXT DEFAULT 'auto',  -- auto | user
  status TEXT DEFAULT 'completed',
  installment_number INTEGER,
  installment_total INTEGER,
  recurring_charge_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recurring_charges (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  merchant_clean TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  expected_amount_agorot INTEGER,
  frequency TEXT,             -- monthly | weekly | yearly
  next_expected_date TEXT,
  confidence REAL,
  status TEXT DEFAULT 'active' -- active | flagged_unused
);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  category_id TEXT REFERENCES categories(id),
  month TEXT NOT NULL,
  limit_agorot INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  target_agorot INTEGER NOT NULL,
  saved_agorot INTEGER DEFAULT 0,
  target_date TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  actor TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
