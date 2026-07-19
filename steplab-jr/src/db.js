const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'storage');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'steplab.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',   -- student / teacher / parent / admin
  grade INTEGER DEFAULT 1,
  settings TEXT DEFAULT '{}',             -- 支援教育モード・表示設定(JSON)
  xp INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  status TEXT DEFAULT 'none',             -- none/learned/practiced/cleared
  best_score INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,                -- 1初級 2標準 3応用 4発展 (AI自動調整)
  attempts INTEGER DEFAULT 0,
  correct INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (user_id, unit_id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  mode TEXT NOT NULL,                     -- practice / test / review
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  duration_sec INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  due_date TEXT NOT NULL,                 -- YYYY-MM-DD (忘却曲線: 1,3,7,14,30日後)
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS badges (
  user_id INTEGER NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (user_id, badge_id)
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  PRIMARY KEY (user_id, unit_id)
);
CREATE TABLE IF NOT EXISTS chat_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,                     -- user / assistant
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  teacher_name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_code TEXT NOT NULL,
  grade INTEGER NOT NULL,
  unit_id TEXT NOT NULL,
  due_date TEXT,
  note TEXT,
  teacher TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_code, grade);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id, due_date, done);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_log(user_id, created_at);
`);

// 既存DBへのマイグレーション(class_code列)
try { db.exec("ALTER TABLE users ADD COLUMN class_code TEXT"); } catch {}

module.exports = db;
