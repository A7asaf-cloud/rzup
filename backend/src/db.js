const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "pinkas.db");

function getDb() {
  const isNew = !fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  if (isNew) {
    const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.sql"), "utf8");
    db.exec(schema);
  }
  return db;
}

module.exports = { getDb, DB_PATH };
