// STEP LAB. Jr. — サーバー本体
// Node.js + Express + SQLite。ブラウザだけで利用できる独立Webサービス。
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const db = require('./src/db');
const { UNITS, SUBJECTS } = require('./data/curriculum');
const { buildQuestions } = require('./data/questions');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'storage');
let SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  // 環境変数が無い場合は、一度生成した鍵をディスクに保存して再起動後も同じ鍵を使う
  const keyFile = path.join(DATA_DIR, 'secret.key');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(keyFile)) SECRET = fs.readFileSync(keyFile, 'utf8').trim();
    if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(keyFile, SECRET, { mode: 0o600 }); }
  } catch { SECRET = crypto.randomBytes(32).toString('hex'); }
  console.warn('[warn] JWT_SECRET未設定: storage/secret.key に保存した鍵を使用します。');
}

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const UNIT_MAP = Object.fromEntries(UNITS.map(u => [u.id, u]));
const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD (ローカル)

/* ---------------- 認証 ---------------- */
function setToken(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30 * 864e5 });
}
function auth(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.token, SECRET);
    req.user = db.prepare('SELECT id,email,name,role,grade,settings,xp,class_code FROM users WHERE id=?').get(payload.id);
    if (!req.user) throw new Error();
    next();
  } catch { res.status(401).json({ error: 'ログインが必要です' }); }
}
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: '権限がありません' });

app.get('/api/health', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  res.json({ ok: true, users, dataDir: DATA_DIR, persistent: !!process.env.DATA_DIR, uptimeSec: Math.round(process.uptime()) });
});
app.post('/api/auth/register', (req, res) => {
  const { password, name, grade, role } = req.body || {};
  // スマホの自動入力は前後に空白が入ることがあるため、先に正規化してから検証する
  const email = String((req.body || {}).email || '').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'メールアドレスの形式が正しくありません' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上にしてください' });
  if (!name) return res.status(400).json({ error: 'なまえを入力してください' });
  const g = Math.min(6, Math.max(1, parseInt(grade) || 1));
  const safeRole = ['student', 'teacher', 'parent'].includes(role) ? role : 'student';
  let cc = null;
  if (req.body.classCode) {
    cc = String(req.body.classCode).trim().toUpperCase();
    if (!db.prepare('SELECT 1 FROM classes WHERE code=?').get(cc))
      return res.status(400).json({ error: 'そのクラスコードは見つかりません' });
  }
  try {
    const info = db.prepare('INSERT INTO users(email,pass_hash,name,role,grade,class_code) VALUES(?,?,?,?,?,?)')
      .run(email, bcrypt.hashSync(password, 10), String(name).slice(0, 30), safeRole, g, cc);
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
    setToken(res, user);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'このメールアドレスは登録済みです' });
    res.status(500).json({ error: '登録に失敗しました' });
  }
});
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase().trim());
  if (!user)
    return res.status(401).json({ error: 'このメールアドレスは登録されていません。サーバーのデータが初期化された可能性もあります(先生に連絡してください)' });
  if (!bcrypt.compareSync(password || '', user.pass_hash))
    return res.status(401).json({ error: 'パスワードがちがいます' });
  setToken(res, user);
  res.json({ ok: true, user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.post('/api/auth/forgot', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').toLowerCase().trim());
  // ユーザー存在の有無は返さない(列挙攻撃対策)。存在すればトークン発行。
  let devLink = null;
  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare(`INSERT INTO reset_tokens(token,user_id,expires_at) VALUES(?,?,datetime('now','+1 hour'))`).run(token, user.id);
    // メール送信基盤(SMTP)は環境依存のため未接続。開発・校内運用向けにリンクを返す。
    devLink = `/#/reset/${token}`;
  }
  res.json({ ok: true, message: '登録済みのメールアドレスであれば再設定リンクが発行されます。', devLink });
});
app.post('/api/auth/reset', (req, res) => {
  const { token, password } = req.body || {};
  if (!password || password.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上にしてください' });
  const row = db.prepare(`SELECT * FROM reset_tokens WHERE token=? AND expires_at > datetime('now')`).get(token || '');
  if (!row) return res.status(400).json({ error: 'リンクが無効か期限切れです' });
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), row.user_id);
  db.prepare('DELETE FROM reset_tokens WHERE user_id=?').run(row.user_id);
  res.json({ ok: true });
});
app.put('/api/auth/profile', auth, (req, res) => {
  const { name, grade, email, settings } = req.body || {};
  const u = req.user;
  const newName = name ? String(name).slice(0, 30) : u.name;
  const newGrade = grade ? Math.min(6, Math.max(1, parseInt(grade))) : u.grade;
  const newEmail = email ? String(email).toLowerCase().trim() : u.email;
  const newSettings = settings ? JSON.stringify(settings).slice(0, 2000) : u.settings;
  try {
    db.prepare('UPDATE users SET name=?,grade=?,email=?,settings=? WHERE id=?').run(newName, newGrade, newEmail, newSettings, u.id);
    res.json({ ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'このメールアドレスは使用できません' });
    res.status(500).json({ error: '更新に失敗しました' });
  }
});
app.put('/api/auth/password', auth, (req, res) => {
  const { current, next } = req.body || {};
  const full = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(current || '', full.pass_hash)) return res.status(401).json({ error: '現在のパスワードがちがいます' });
  if (!next || next.length < 8) return res.status(400).json({ error: '新しいパスワードは8文字以上にしてください' });
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(next, 10), req.user.id);
  res.json({ ok: true });
});
function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, grade: u.grade, xp: u.xp, level: levelOf(u.xp), classCode: u.class_code || null, settings: JSON.parse(u.settings || '{}') };
}
const levelOf = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
const xpForLevel = lv => (lv - 1) * (lv - 1) * 50;

/* ---------------- カリキュラム ---------------- */
app.get('/api/curriculum', auth, (req, res) => {
  const prog = Object.fromEntries(db.prepare('SELECT * FROM progress WHERE user_id=?').all(req.user.id).map(p => [p.unit_id, p]));
  const favs = new Set(db.prepare('SELECT unit_id FROM favorites WHERE user_id=?').all(req.user.id).map(r => r.unit_id));
  res.json({
    subjects: SUBJECTS,
    units: UNITS.map(u => ({
      id: u.id, subject: u.subject, grade: u.grade, name: u.name, note: u.note, advanced: !!u.advanced,
      progress: prog[u.id] ? { status: prog[u.id].status, best: prog[u.id].best_score, level: prog[u.id].level } : null,
      fav: favs.has(u.id),
    })),
  });
});
app.post('/api/favorites/:unitId', auth, (req, res) => {
  const id = req.params.unitId;
  if (!UNIT_MAP[id]) return res.status(404).json({ error: '単元が見つかりません' });
  const ex = db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND unit_id=?').get(req.user.id, id);
  if (ex) db.prepare('DELETE FROM favorites WHERE user_id=? AND unit_id=?').run(req.user.id, id);
  else db.prepare('INSERT INTO favorites VALUES(?,?)').run(req.user.id, id);
  res.json({ ok: true, fav: !ex });
});

/* ---------------- 出題 ---------------- */
app.get('/api/units/:id/questions', auth, (req, res) => {
  const unit = UNIT_MAP[req.params.id];
  if (!unit) return res.status(404).json({ error: '単元が見つかりません' });
  const mode = req.query.mode === 'test' ? 'test' : req.query.mode === 'review' ? 'review' : 'practice';
  const prog = db.prepare('SELECT * FROM progress WHERE user_id=? AND unit_id=?').get(req.user.id, unit.id);
  const level = prog ? prog.level : 1;
  const settings = JSON.parse(req.user.settings || '{}');
  const n = mode === 'test' ? (settings.support ? 6 : 8) : (settings.support ? 4 : 6);
  const qs = buildQuestions(unit, n, level, { reduceChoices: settings.support && settings.fewerChoices });
  res.json({ unit: { id: unit.id, name: unit.name, note: unit.note }, mode, level, questions: qs });
});

/* ---------------- 学習記録 ---------------- */
const BADGE_DEFS = {
  first_clear: { name: 'はじめてのクリア', icon: '🌟', desc: '単元テストにはじめて合格した' },
  ten_units: { name: '単元マスター×10', icon: '🏅', desc: '10単元をクリアした' },
  streak3: { name: '3日れんぞく', icon: '🔥', desc: '3日連続で学習した' },
  streak7: { name: '1週間れんぞく', icon: '⚡', desc: '7日連続で学習した' },
  streak30: { name: '1か月れんぞく', icon: '👑', desc: '30日連続で学習した' },
  q100: { name: '100問チャレンジ', icon: '💯', desc: '合計100問に挑戦した' },
  q500: { name: '500問チャレンジ', icon: '🚀', desc: '合計500問に挑戦した' },
  perfect: { name: 'パーフェクト', icon: '💎', desc: 'テストで全問正解した' },
  reviewer: { name: 'ふくしゅう名人', icon: '📚', desc: '復習を10回やりとげた' },
};
function grantBadge(userId, badgeId) {
  try { db.prepare('INSERT INTO badges(user_id,badge_id) VALUES(?,?)').run(userId, badgeId); return true; } catch { return false; }
}
function calcStreak(userId) {
  const days = new Set(db.prepare("SELECT DISTINCT date(created_at) d FROM attempts WHERE user_id=?").all(userId).map(r => r.d));
  let streak = 0; const d = new Date();
  if (!days.has(d.toLocaleDateString('sv-SE'))) d.setDate(d.getDate() - 1); // 今日未学習なら昨日から数える
  while (days.has(d.toLocaleDateString('sv-SE'))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

app.post('/api/attempts', auth, (req, res) => {
  const { unitId, mode, correct, total, durationSec, reviewId } = req.body || {};
  const unit = UNIT_MAP[unitId];
  if (!unit) return res.status(404).json({ error: '単元が見つかりません' });
  const c = Math.max(0, Math.min(parseInt(correct) || 0, 50));
  const t = Math.max(1, Math.min(parseInt(total) || 1, 50));
  const m = ['practice', 'test', 'review'].includes(mode) ? mode : 'practice';
  db.prepare('INSERT INTO attempts(user_id,unit_id,mode,correct,total,duration_sec) VALUES(?,?,?,?,?,?)')
    .run(req.user.id, unitId, m, c, t, Math.max(0, Math.min(parseInt(durationSec) || 0, 7200)));

  // 進捗更新
  db.prepare(`INSERT INTO progress(user_id,unit_id,status,attempts,correct,total,updated_at)
    VALUES(?,?,?,1,?,?,datetime('now','localtime'))
    ON CONFLICT(user_id,unit_id) DO UPDATE SET attempts=attempts+1, correct=correct+?, total=total+?, updated_at=datetime('now','localtime')`)
    .run(req.user.id, unitId, m === 'practice' ? 'practiced' : 'none', c, t, c, t);

  const prog = db.prepare('SELECT * FROM progress WHERE user_id=? AND unit_id=?').get(req.user.id, unitId);
  const score = Math.round(c / t * 100);
  let cleared = false;

  if (m === 'test') {
    if (score > prog.best_score) db.prepare('UPDATE progress SET best_score=? WHERE user_id=? AND unit_id=?').run(score, req.user.id, unitId);
    if (score >= 80) {
      cleared = true;
      db.prepare("UPDATE progress SET status='cleared' WHERE user_id=? AND unit_id=?").run(req.user.id, unitId);
      // 忘却曲線に基づく復習スケジュール (翌日/3日/7日/14日/30日後)
      const has = db.prepare('SELECT COUNT(*) n FROM reviews WHERE user_id=? AND unit_id=? AND done=0').get(req.user.id, unitId).n;
      if (!has) {
        const ins = db.prepare("INSERT INTO reviews(user_id,unit_id,due_date) VALUES(?,?,date('now','localtime',?))");
        for (const d of [1, 3, 7, 14, 30]) ins.run(req.user.id, unitId, `+${d} days`);
      }
    }
  }
  if (m === 'review' && reviewId) {
    db.prepare('UPDATE reviews SET done=1 WHERE id=? AND user_id=?').run(reviewId, req.user.id);
  }
  // AIレベル自動調整: 直近の単元正答率で 初級→標準→応用→発展
  const acc = prog.total + t > 0 ? (prog.correct + 0) / Math.max(1, prog.total) : 0;
  const rate = c / t;
  let newLevel = prog.level;
  if (rate >= 0.9 && newLevel < 4) newLevel++;
  else if (rate < 0.5 && newLevel > 1) newLevel--;
  if (newLevel !== prog.level) db.prepare('UPDATE progress SET level=? WHERE user_id=? AND unit_id=?').run(newLevel, req.user.id, unitId);

  // XP付与
  const gained = c * 10 + (cleared ? 50 : 0) + (m === 'review' ? 10 : 0);
  db.prepare('UPDATE users SET xp=xp+? WHERE id=?').run(gained, req.user.id);
  const xp = db.prepare('SELECT xp FROM users WHERE id=?').get(req.user.id).xp;

  // バッジ判定
  const newBadges = [];
  const tryBadge = id => { if (grantBadge(req.user.id, id)) newBadges.push(Object.assign({ id }, BADGE_DEFS[id])); };
  if (cleared) tryBadge('first_clear');
  if (m === 'test' && score === 100) tryBadge('perfect');
  const clearedCount = db.prepare("SELECT COUNT(*) n FROM progress WHERE user_id=? AND status='cleared'").get(req.user.id).n;
  if (clearedCount >= 10) tryBadge('ten_units');
  const totalQ = db.prepare('SELECT COALESCE(SUM(total),0) n FROM attempts WHERE user_id=?').get(req.user.id).n;
  if (totalQ >= 100) tryBadge('q100');
  if (totalQ >= 500) tryBadge('q500');
  const reviewsDone = db.prepare("SELECT COUNT(*) n FROM attempts WHERE user_id=? AND mode='review'").get(req.user.id).n;
  if (reviewsDone >= 10) tryBadge('reviewer');
  const streak = calcStreak(req.user.id);
  if (streak >= 3) tryBadge('streak3');
  if (streak >= 7) tryBadge('streak7');
  if (streak >= 30) tryBadge('streak30');

  res.json({ ok: true, score, cleared, gainedXp: gained, xp, level: levelOf(xp), unitLevel: newLevel, streak, newBadges });
});

/* ---------------- ホーム(ダッシュボード) ---------------- */
app.get('/api/home', auth, (req, res) => {
  const uid = req.user.id;
  const g = req.user.grade;
  const todayStats = db.prepare("SELECT COALESCE(SUM(duration_sec),0) sec, COALESCE(SUM(correct),0) c, COALESCE(SUM(total),0) t FROM attempts WHERE user_id=? AND date(created_at)=date('now','localtime')").get(uid);
  const weekStats = db.prepare("SELECT COALESCE(SUM(duration_sec),0) sec FROM attempts WHERE user_id=? AND date(created_at)>=date('now','localtime','-6 days')").get(uid);
  const recent = db.prepare("SELECT COALESCE(SUM(correct),0) c, COALESCE(SUM(total),0) t FROM attempts WHERE user_id=? AND date(created_at)>=date('now','localtime','-13 days')").get(uid);
  const weak = db.prepare('SELECT unit_id, correct, total FROM progress WHERE user_id=? AND total>=5 ORDER BY CAST(correct AS REAL)/total ASC LIMIT 3').all(uid)
    .filter(w => w.correct / w.total < 0.7).map(w => ({ unit: unitLite(w.unit_id), acc: Math.round(w.correct / w.total * 100) }));
  const reviewsDue = db.prepare("SELECT id, unit_id, due_date FROM reviews WHERE user_id=? AND done=0 AND due_date<=date('now','localtime') ORDER BY due_date LIMIT 5").all(uid)
    .map(r => ({ id: r.id, due: r.due_date, unit: unitLite(r.unit_id) }));
  const last = db.prepare('SELECT unit_id FROM attempts WHERE user_id=? ORDER BY id DESC LIMIT 1').get(uid);
  const cleared = new Set(db.prepare("SELECT unit_id FROM progress WHERE user_id=? AND status='cleared'").all(uid).map(r => r.unit_id));
  const gradeUnits = UNITS.filter(u => u.grade === g && !u.advanced);
  const recommend = gradeUnits.find(u => !cleared.has(u.id)) || gradeUnits[0] || UNITS[0];
  const xp = req.user.xp, lv = levelOf(xp);
  const streak = calcStreak(uid);
  const name = req.user.name;
  let aiMsg;
  if (reviewsDue.length) aiMsg = `${name}さん、今日は 復習が ${reviewsDue.length}件 あるよ。復習すると 記憶が ぐんと 強くなる！まずは 1つ やってみよう🔥`;
  else if (weak.length) aiMsg = `${name}さん、「${weak[0].unit.name}」を もう一度 練習すると 力が つきそうだよ。いっしょに がんばろう💪`;
  else if (streak >= 3) aiMsg = `${streak}日連続 学習中！すごい！この調子で「${recommend.name}」に 挑戦してみよう🚀`;
  else aiMsg = `こんにちは、${name}さん！今日の おすすめは「${recommend.name}」。「学ぶ→練習→テスト」の ステップで クリアを 目指そう✨`;
  const homework = req.user.class_code
    ? db.prepare('SELECT * FROM homework WHERE class_code=? AND grade=? ORDER BY id DESC').all(req.user.class_code, g)
        .map(h => ({ id: h.id, unit: unitLite(h.unit_id), due: h.due_date, note: h.note, teacher: h.teacher,
          done: db.prepare("SELECT 1 FROM progress WHERE user_id=? AND unit_id=? AND status='cleared'").get(uid, h.unit_id) ? true : false }))
    : [];
  res.json({
    homework,
    todaySec: todayStats.sec, todayAcc: todayStats.t ? Math.round(todayStats.c / todayStats.t * 100) : null,
    weekSec: weekStats.sec,
    recentAcc: recent.t ? Math.round(recent.c / recent.t * 100) : null,
    weak, reviewsDue,
    continueUnit: last ? unitLite(last.unit_id) : null,
    recommend: unitLite(recommend.id),
    xp, level: lv, nextLevelXp: xpForLevel(lv + 1), levelBaseXp: xpForLevel(lv),
    streak, aiMsg,
  });
});
function unitLite(id) { const u = UNIT_MAP[id]; return u ? { id: u.id, name: u.name, subject: u.subject, grade: u.grade } : null; }

/* ---------------- マイページ ---------------- */
app.get('/api/mypage', auth, (req, res) => {
  const uid = req.user.id;
  const totalSec = db.prepare('SELECT COALESCE(SUM(duration_sec),0) s FROM attempts WHERE user_id=?').get(uid).s;
  const totals = db.prepare('SELECT COALESCE(SUM(correct),0) c, COALESCE(SUM(total),0) t FROM attempts WHERE user_id=?').get(uid);
  const calendar = db.prepare("SELECT date(created_at) d, SUM(total) n FROM attempts WHERE user_id=? AND date(created_at)>=date('now','localtime','-59 days') GROUP BY d").all(uid);
  const perUnit = db.prepare('SELECT unit_id, correct, total, status, best_score, level FROM progress WHERE user_id=? AND total>=5').all(uid);
  const ranked = perUnit.map(p => ({ unit: unitLite(p.unit_id), acc: Math.round(p.correct / p.total * 100), status: p.status, best: p.best_score, level: p.level }));
  const weakRank = ranked.slice().sort((a, b) => a.acc - b.acc).slice(0, 5);
  const strongRank = ranked.slice().sort((a, b) => b.acc - a.acc).slice(0, 5);
  const badges = db.prepare('SELECT badge_id, earned_at FROM badges WHERE user_id=?').all(uid)
    .map(b => Object.assign({ id: b.badge_id, earned_at: b.earned_at }, BADGE_DEFS[b.badge_id] || {}));
  const clearedCount = db.prepare("SELECT COUNT(*) n FROM progress WHERE user_id=? AND status='cleared'").get(uid).n;
  const gradeTotal = UNITS.filter(u => u.grade === req.user.grade && !u.advanced).length;
  const gradeCleared = db.prepare(`SELECT COUNT(*) n FROM progress WHERE user_id=? AND status='cleared'`).all ? UNITS.filter(u => u.grade === req.user.grade && !u.advanced && db.prepare("SELECT status FROM progress WHERE user_id=? AND unit_id=?").get(uid, u.id)?.status === 'cleared').length : 0;
  const xp = req.user.xp, lv = levelOf(xp);
  const acc = totals.t ? Math.round(totals.c / totals.t * 100) : null;
  let aiComment;
  if (!totals.t) aiComment = 'まだ 学習記録が ないよ。今日 はじめの 一歩を ふみ出そう！';
  else if (acc >= 85) aiComment = `全体の 正答率が ${acc}%！とても 安定しているよ。応用・発展レベルにも どんどん 挑戦しよう。`;
  else if (weakRank.length) aiComment = `「${weakRank[0].unit.name}」の 正答率が ${weakRank[0].acc}%。ここを 復習すると 全体が ぐっと 伸びるよ。`;
  else aiComment = 'コツコツ 続けているのが すばらしい！復習の タイミングを 大切にしよう。';
  res.json({
    totalSec, acc, calendar, weakRank, strongRank, badges,
    clearedCount, gradeTotal, gradeCleared,
    xp, level: lv, nextLevelXp: xpForLevel(lv + 1), levelBaseXp: xpForLevel(lv),
    streak: calcStreak(uid), aiComment,
    badgeDefs: BADGE_DEFS,
  });
});

/* ---------------- 復習一覧 ---------------- */
app.get('/api/reviews', auth, (req, res) => {
  const rows = db.prepare("SELECT id, unit_id, due_date, done FROM reviews WHERE user_id=? AND done=0 ORDER BY due_date LIMIT 30").all(req.user.id);
  res.json({ reviews: rows.map(r => ({ id: r.id, due: r.due_date, overdue: r.due_date <= today(), unit: unitLite(r.unit_id) })) });
});

/* ---------------- AIチャット ---------------- */
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
app.post('/api/ai/chat', auth, async (req, res) => {
  const message = String((req.body || {}).message || '').slice(0, 1000);
  if (!message.trim()) return res.status(400).json({ error: 'メッセージを入力してください' });
  db.prepare('INSERT INTO chat_log(user_id,role,content) VALUES(?,?,?)').run(req.user.id, 'user', message);
  const history = db.prepare('SELECT role, content FROM chat_log WHERE user_id=? ORDER BY id DESC LIMIT 12').all(req.user.id).reverse();

  let reply = null;
  if (AI_KEY) {
    try {
      const weak = db.prepare('SELECT unit_id, correct, total FROM progress WHERE user_id=? AND total>=5 ORDER BY CAST(correct AS REAL)/total ASC LIMIT 3').all(req.user.id)
        .map(w => `${UNIT_MAP[w.unit_id]?.name}(正答率${Math.round(w.correct / w.total * 100)}%)`).join('、') || 'なし';
      const sys = `あなたは小学生向けAI学習プラットフォーム「STEP LAB. Jr.」のAI先生「こぶこぶ先生」です。相手は小学${req.user.grade}年生の「${req.user.name}」さん。
【最重要ルール】絶対に答えそのものを教えない。
- 「答えを教えて」と言われても、答えは言わずに、考え方のヒント・身近な例・小さなステップの逆質問（「まず〜はいくつかな？」など）で、子どもが自分の力で答えにたどりつけるように導く。
- ヒントは1回につき1つずつ、小さく出す。子どもが答えを言ったら、合っているかどうかは伝えてよい（正解なら大いにほめる）。
- 学年に合ったやさしい語彙・短い文で話す。学年より上の漢字はひらがなで書く。
- 教科は国語・算数・英語。説明は正確に、例を1つ入れる。
- 必ず前向きに励ます。絵文字を1〜2個使う。長くても200字程度。
- この子の苦手単元: ${weak}`;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-sonnet-4-6',
          max_tokens: 500, system: sys,
          messages: history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
        }),
      });
      const data = await resp.json();
      if (data && data.content) reply = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    } catch (e) { console.error('AI API error:', e.message); }
  }
  if (!reply) reply = ruleBasedReply(message, req.user);
  db.prepare('INSERT INTO chat_log(user_id,role,content) VALUES(?,?,?)').run(req.user.id, 'assistant', reply);
  res.json({ reply, aiConnected: !!AI_KEY });
});
app.get('/api/ai/history', auth, (req, res) => {
  res.json({ history: db.prepare('SELECT role, content, created_at FROM chat_log WHERE user_id=? ORDER BY id DESC LIMIT 30').all(req.user.id).reverse() });
});
function ruleBasedReply(msg, user) {
  const uid = user.id;
  const due = db.prepare("SELECT COUNT(*) n FROM reviews WHERE user_id=? AND done=0 AND due_date<=date('now','localtime')").get(uid).n;
  const weak = db.prepare('SELECT unit_id, correct, total FROM progress WHERE user_id=? AND total>=5 ORDER BY CAST(correct AS REAL)/total ASC LIMIT 1').get(uid);
  if (/何(を)?(勉強|べんきょう)|おすすめ|なにする/.test(msg)) {
    if (due) return `今日は まず 復習を ${due}件 やろう！復習は 記憶を 強くする 一番の 近道だよ🔥 そのあと 新しい 単元に すすもう。`;
    if (weak && weak.correct / weak.total < 0.7) return `「${UNIT_MAP[weak.unit_id]?.name}」を もう一度 練習するのが おすすめ！正答率が 上がると レベルも 上がるよ💪`;
    return `${user.grade}年生の まだ クリアしていない 単元から えらんでみよう。「学ぶ」で まとめノートを 読んでから 練習すると スムーズだよ✨`;
  }
  if (/わからない|むずかしい|できない/.test(msg)) return `だいじょうぶ、わからないのは 成長の チャンスだよ😊 その単元の「学ぶ」を もう一度 読んで、練習を「初級」から やってみよう。どの問題で つまずいたか 教えてくれたら いっしょに 考えるよ。`;
  if (/テスト.*(前|まで)|あした.*テスト/.test(msg)) return `テスト前は ①苦手単元の 練習 → ②確認テスト → ③まちがえた 問題の 見直し の 順番が おすすめ！一夜づけより 毎日 少しずつがコツだよ📚`;
  if (/ありがとう/.test(msg)) return `どういたしまして😊 いつでも 聞いてね。${user.name}さんの がんばりを 応援しているよ！`;
  if (/こんにちは|やあ|おはよう|こんばんは/.test(msg)) return `こんにちは、${user.name}さん！こぶこぶ先生だよ😊 勉強のこと、なんでも 聞いてね。`;
  return `いい質問だね！くわしい 説明が できる AI先生は、先生（管理者）が APIキーを 設定すると 使えるように なるよ。今は「どの単元が おすすめ？」「テストまでに 何を すればいい？」などに 答えられるよ😊`;
}

/* ---------------- クラス(クラスコード) ---------------- */
function genClassCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
  return c;
}
app.post('/api/class/create', auth, requireRole('teacher', 'admin'), (req, res) => {
  let code = genClassCode(), tries = 0;
  while (db.prepare('SELECT 1 FROM classes WHERE code=?').get(code) && tries++ < 20) code = genClassCode();
  db.prepare('INSERT INTO classes(code,teacher_name) VALUES(?,?)').run(code, req.user.name);
  db.prepare('UPDATE users SET class_code=? WHERE id=?').run(code, req.user.id);
  res.json({ ok: true, code });
});
app.post('/api/class/join', auth, (req, res) => {
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  const cls = db.prepare('SELECT * FROM classes WHERE code=?').get(code);
  if (!cls) return res.status(404).json({ error: 'そのクラスコードは見つかりません' });
  db.prepare('UPDATE users SET class_code=? WHERE id=?').run(code, req.user.id);
  res.json({ ok: true, code, teacherName: cls.teacher_name });
});
app.post('/api/class/leave', auth, (req, res) => {
  db.prepare('UPDATE users SET class_code=NULL WHERE id=?').run(req.user.id);
  res.json({ ok: true });
});
app.get('/api/class', auth, (req, res) => {
  if (!req.user.class_code) return res.json({ class: null });
  res.json({ class: db.prepare('SELECT * FROM classes WHERE code=?').get(req.user.class_code) || null });
});

/* ---------------- 教員用 ---------------- */
function studentStats(uid) {
  const t = db.prepare('SELECT COALESCE(SUM(correct),0) c, COALESCE(SUM(total),0) t, COALESCE(SUM(duration_sec),0) s FROM attempts WHERE user_id=?').get(uid);
  const today = db.prepare("SELECT COALESCE(SUM(total),0) n, COALESCE(SUM(duration_sec),0) s FROM attempts WHERE user_id=? AND date(created_at)=date('now','localtime')").get(uid);
  return {
    acc: t.t ? Math.round(t.c / t.t * 100) : null, totalQ: t.t, totalSec: t.s,
    todayN: today.n, todaySec: today.s,
    cleared: db.prepare("SELECT COUNT(*) n FROM progress WHERE user_id=? AND status='cleared'").get(uid).n,
    streak: calcStreak(uid),
  };
}
function requireClass(req, res, next) {
  if (!req.user.class_code) return res.status(400).json({ error: '先にクラスを作成または参加してください' });
  next();
}
app.get('/api/teacher/students', auth, requireRole('teacher', 'admin'), requireClass, (req, res) => {
  const rows = db.prepare("SELECT id,name,grade,xp FROM users WHERE role='student' AND class_code=? ORDER BY grade,name").all(req.user.class_code);
  res.json({ classCode: req.user.class_code, students: rows.map(u => Object.assign({ id: u.id, name: u.name, grade: u.grade, level: levelOf(u.xp) }, studentStats(u.id))) });
});
app.get('/api/teacher/student/:id', auth, requireRole('teacher', 'admin'), requireClass, (req, res) => {
  const u = db.prepare("SELECT id,name,grade,xp,class_code FROM users WHERE id=? AND role='student'").get(parseInt(req.params.id));
  if (!u || u.class_code !== req.user.class_code) return res.status(404).json({ error: '生徒が見つかりません' });
  const stats = studentStats(u.id);
  const weak = db.prepare('SELECT unit_id, correct, total, level FROM progress WHERE user_id=? AND total>=5 ORDER BY CAST(correct AS REAL)/total ASC LIMIT 5').all(u.id)
    .map(w => ({ unit: unitLite(w.unit_id), acc: Math.round(w.correct / w.total * 100), level: w.level })).filter(w => w.unit);
  const hw = db.prepare('SELECT * FROM homework WHERE class_code=? AND grade=? ORDER BY id DESC').all(req.user.class_code, u.grade)
    .map(h => ({ id: h.id, unit: unitLite(h.unit_id), due: h.due_date, note: h.note,
      done: db.prepare("SELECT 1 FROM progress WHERE user_id=? AND unit_id=? AND status='cleared'").get(u.id, h.unit_id) ? true : false }));
  const calendar = db.prepare("SELECT date(created_at) d, SUM(total) n FROM attempts WHERE user_id=? AND date(created_at)>=date('now','localtime','-27 days') GROUP BY d").all(u.id);
  const badges = db.prepare('SELECT badge_id FROM badges WHERE user_id=?').all(u.id).map(b => Object.assign({ id: b.badge_id }, BADGE_DEFS[b.badge_id] || {}));
  const gradeUnits = UNITS.filter(x => x.grade === u.grade && !x.advanced);
  const gradeCleared = gradeUnits.filter(x => db.prepare('SELECT status FROM progress WHERE user_id=? AND unit_id=?').get(u.id, x.id)?.status === 'cleared').length;
  res.json({ student: { id: u.id, name: u.name, grade: u.grade, xp: u.xp, level: levelOf(u.xp) }, stats, weak, homework: hw, calendar, badges, gradeTotal: gradeUnits.length, gradeCleared });
});
app.get('/api/teacher/homework', auth, requireRole('teacher', 'admin'), requireClass, (req, res) => {
  const rows = db.prepare('SELECT * FROM homework WHERE class_code=? ORDER BY id DESC').all(req.user.class_code);
  res.json({ homework: rows.map(h => {
    const targets = db.prepare("SELECT id FROM users WHERE role='student' AND class_code=? AND grade=?").all(req.user.class_code, h.grade);
    const done = targets.filter(t => db.prepare("SELECT 1 FROM progress WHERE user_id=? AND unit_id=? AND status='cleared'").get(t.id, h.unit_id)).length;
    return { id: h.id, grade: h.grade, unit: unitLite(h.unit_id), due: h.due_date, note: h.note, teacher: h.teacher, createdAt: h.created_at, done, total: targets.length };
  }) });
});
app.post('/api/teacher/homework', auth, requireRole('teacher', 'admin'), requireClass, (req, res) => {
  const { grade, unitId, due, note } = req.body || {};
  const g = Math.min(6, Math.max(1, parseInt(grade) || 1));
  if (!UNIT_MAP[unitId]) return res.status(400).json({ error: '単元が見つかりません' });
  const d = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
  const info = db.prepare('INSERT INTO homework(class_code,grade,unit_id,due_date,note,teacher) VALUES(?,?,?,?,?,?)')
    .run(req.user.class_code, g, unitId, d, note ? String(note).slice(0, 60) : null, req.user.name);
  res.json({ ok: true, id: info.lastInsertRowid });
});
app.delete('/api/teacher/homework/:id', auth, requireRole('teacher', 'admin'), requireClass, (req, res) => {
  const info = db.prepare('DELETE FROM homework WHERE id=? AND class_code=?').run(parseInt(req.params.id), req.user.class_code);
  if (!info.changes) return res.status(404).json({ error: '宿題が見つかりません' });
  res.json({ ok: true });
});

/* ---------------- 管理者 ---------------- */
app.get('/api/admin/users', auth, requireRole('admin', 'teacher'), (req, res) => {
  res.json({ users: db.prepare('SELECT id,email,name,role,grade,xp,created_at FROM users ORDER BY id').all().map(u => Object.assign(u, { level: levelOf(u.xp) })) });
});
app.get('/api/admin/user/:id/summary', auth, requireRole('admin', 'teacher', 'parent'), (req, res) => {
  const uid = parseInt(req.params.id);
  const u = db.prepare('SELECT id,name,grade,xp FROM users WHERE id=?').get(uid);
  if (!u) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  const totals = db.prepare('SELECT COALESCE(SUM(correct),0) c, COALESCE(SUM(total),0) t, COALESCE(SUM(duration_sec),0) s FROM attempts WHERE user_id=?').get(uid);
  const cleared = db.prepare("SELECT COUNT(*) n FROM progress WHERE user_id=? AND status='cleared'").get(uid).n;
  res.json({ user: u, acc: totals.t ? Math.round(totals.c / totals.t * 100) : null, totalSec: totals.s, cleared, streak: calcStreak(uid) });
});

/* ---------------- 静的配信 & PWA ---------------- */
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`STEP LAB. Jr. → http://localhost:${PORT}`));
}
module.exports = app;
