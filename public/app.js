/* STEP LAB. Jr. — フロントエンド SPA */
'use strict';
const $ = s => document.querySelector(s);
const main = $('#main');
let ME = null;          // ログイン中ユーザー
let CURR = null;        // カリキュラムキャッシュ
const SUBJ = { ja: { name: 'こくご', icon: '📖', cls: 'ja' }, math: { name: 'さんすう', icon: '🔢', cls: 'math' }, en: { name: 'えいご', icon: '🌏', cls: 'en' } };
const GRADE_LABEL = g => `小${g}`;

/* ---------- API ---------- */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' }, opts,
    opts.body ? { body: JSON.stringify(opts.body) } : {}));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'エラーが発生しました'), { status: res.status });
  return data;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._tm); t._tm = setTimeout(() => t.hidden = true, 2600); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function fmtMin(sec) { const m = Math.round(sec / 60); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60}分` : `${m}分`; }

/* ---------- 設定の適用 ---------- */
function applySettings() {
  const s = (ME && ME.settings) || {};
  const html = document.documentElement;
  html.dataset.theme = s.dark ? 'dark' : '';
  html.dataset.fontsize = s.fontSize || '';
  html.dataset.bg = s.dark ? '' : (s.bg || '');
  html.dataset.support = s.support ? 'on' : '';
  html.dataset.focus = s.focus ? 'on' : '';
}
/* ---------- 音声読み上げ (Web Speech API) ---------- */
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('この端末は 読み上げに 対応していません'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[（(].*?[)）]/g, ''));
  u.lang = /[a-zA-Z]{3,}/.test(text) ? 'en-US' : 'ja-JP';
  u.rate = (ME?.settings?.ttsRate) || 0.95;
  speechSynthesis.speak(u);
}
const ttsBtn = text => `<button class="icon-btn tts-btn" data-tts="${esc(text)}" aria-label="読み上げる">🔊</button>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-tts]'); if (b) speak(b.dataset.tts); });

/* ---------- ルーター ---------- */
const routes = [];
function route(pattern, fn) { routes.push({ pattern, fn }); }
async function navigate() {
  const hash = location.hash.replace(/^#/, '') || '/home';
  if (!ME && !hash.startsWith('/login') && !hash.startsWith('/reset')) { location.replace('#/login'); return; }
  if (ME?.role === 'teacher' && !hash.startsWith('/t/') && !hash.startsWith('/login') && !hash.startsWith('/reset')) { location.replace(ME.classCode ? '#/t/home' : '#/t/setup'); return; }
  if (ME && ME.role !== 'teacher' && hash.startsWith('/t/')) { location.replace('#/home'); return; }
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) {
      document.querySelectorAll('.topnav a').forEach(a => a.classList.toggle('active', hash.startsWith('/' + a.dataset.nav)));
      try { await r.fn(...m.slice(1)); } catch (e) {
        if (e.status === 401) { ME = null; location.hash = '#/login'; return; }
        main.innerHTML = `<div class="card"><h3>⚠️ エラー</h3><p>${esc(e.message)}</p></div>`;
      }
      main.focus({ preventScroll: true }); window.scrollTo(0, 0);
      return;
    }
  }
  location.replace('#/home');
}
window.addEventListener('hashchange', navigate);
// 同じURLへのリンク(「もう一回」など)は hashchange が発火しないため、手動で再描画する
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#/"]');
  if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); navigate(); }
});

/* ================= ログイン / 新規登録 ================= */
route(/^\/login$/, () => {
  $('#topbar').hidden = true; $('#chatFab').hidden = true;
  let mode = 'login';
  const render = (err) => {
    main.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo">
        <span class="brand-mark" aria-hidden="true">▲</span>
        <div class="brand-name" style="font-size:1.4rem;font-weight:900">STEP LAB.<small style="color:var(--brand)">Jr.</small></div>
        <p class="muted">AIといっしょに 学ぶ 小学生の学習サイト</p>
      </div>
      <div class="card">
        ${err ? `<div class="error-box">${esc(err)}</div>` : ''}
        <form id="authForm">
          ${mode === 'register' ? `
          <label class="field"><span>登録する人</span><select name="role" id="regRole"><option value="student">🎒 生徒（べんきょうする人）</option><option value="teacher">👩‍🏫 教師（宿題を出す・見守る人）</option></select></label>
          <label class="field"><span>なまえ（ニックネームでOK）</span><input name="name" required maxlength="30" autocomplete="nickname"></label>
          <span id="stuFields">
          <label class="field"><span>学年</span><select name="grade">${[1,2,3,4,5,6].map(g=>`<option value="${g}">小学${g}年生</option>`).join('')}</select></label>
          <label class="field"><span>クラスコード（先生から もらった人だけ・あとからでもOK）</span><input name="classCode" maxlength="8" placeholder="例：AB3D" style="text-transform:uppercase"></label>
          </span>` : ''}
          <label class="field"><span>メールアドレス</span><input name="email" type="email" required autocomplete="email"></label>
          <label class="field"><span>パスワード（8文字以上）</span><input name="password" type="password" required minlength="8" autocomplete="${mode==='login'?'current-password':'new-password'}"></label>
          <button class="btn btn-primary btn-big" style="width:100%">${mode === 'login' ? 'ログイン' : 'アカウントを つくる'}</button>
        </form>
        <div class="spacer"></div>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <button class="btn-ghost btn" id="switchMode">${mode === 'login' ? 'はじめての人は こちら（新規登録）' : 'ログインは こちら'}</button>
          ${mode === 'login' ? '<button class="btn-ghost btn" id="forgot">パスワードを わすれた</button>' : ''}
        </div>
      </div>
      <p class="muted" style="text-align:center;margin-top:14px">どの端末からでも 同じアカウントで 学習の つづきが できます。</p>
    </div>`;
    $('#switchMode').onclick = () => { mode = mode === 'login' ? 'register' : 'login'; render(); };
    const regRole = $('#regRole');
    if (regRole) regRole.onchange = () => { $('#stuFields').style.display = regRole.value === 'teacher' ? 'none' : ''; };
    const forgot = $('#forgot'); if (forgot) forgot.onclick = async () => {
      const email = new FormData($('#authForm')).get('email');
      if (!email) return render('先に メールアドレスを 入力してね');
      const r = await api('/auth/forgot', { method: 'POST', body: { email } });
      main.querySelector('.card').insertAdjacentHTML('afterbegin',
        `<div class="error-box" style="background:var(--brand-soft);color:var(--brand)">${esc(r.message)}${r.devLink ? `<br><a href="${r.devLink}">→ 再設定ページを ひらく</a><br><small>※メール送信は 管理者がSMTPを 設定すると 有効になります</small>` : ''}</div>`);
    };
    $('#authForm').onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        const r = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: f });
        ME = r.user; applySettings(); location.hash = '#/home';
      } catch (err) { render(err.message); }
    };
  };
  render();
});

route(/^\/reset\/(.+)$/, (token) => {
  $('#topbar').hidden = true;
  main.innerHTML = `<div class="auth-wrap"><div class="card">
    <h3>🔑 パスワード再設定</h3>
    <form id="resetForm">
      <label class="field"><span>新しいパスワード（8文字以上）</span><input name="password" type="password" required minlength="8"></label>
      <button class="btn btn-primary" style="width:100%">再設定する</button>
    </form></div></div>`;
  $('#resetForm').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/auth/reset', { method: 'POST', body: { token, password: new FormData(e.target).get('password') } });
      toast('パスワードを 再設定しました'); location.hash = '#/login';
    } catch (err) { toast(err.message); }
  };
});

/* ================= ホーム ================= */
route(/^\/home$/, async () => {
  showChrome();
  const h = await api('/home');
  const pct = Math.min(100, Math.round((h.xp - h.levelBaseXp) / (h.nextLevelXp - h.levelBaseXp) * 100));
  const remain = h.nextLevelXp - h.xp;
  main.innerHTML = `
  <p class="hello">こんにちは、${esc(ME.name)}さん！</p>
  <p class="muted">${GRADE_LABEL(ME.grade)}・レベル${h.level}　${h.streak ? `<span class="streak-flame">🔥</span> ${h.streak}日れんぞく学習中` : '今日から 学習を はじめよう'}</p>

  <div class="ai-note"><span class="a-icon" aria-hidden="true">🤖</span><div><strong>こぶこぶ先生から</strong><br>${esc(h.aiMsg)} ${ttsBtn(h.aiMsg)}</div></div>

  <div class="grid grid-3">
    <div class="card"><h3>⏱ 今日の学習</h3><div class="stat">${fmtMin(h.todaySec)}</div><p class="muted">今週合計 ${fmtMin(h.weekSec)}</p></div>
    <div class="card"><h3>🎯 さいきんの正答率</h3><div class="stat">${h.recentAcc == null ? '—' : h.recentAcc + '<small>%</small>'}</div><p class="muted">直近2週間</p></div>
    <div class="card"><h3>⭐ レベルアップまで</h3>
      <div class="xp-bar"><i style="width:${pct}%"></i></div>
      <p class="muted">あと <strong>${remain}</strong> XP で レベル${h.level + 1}！</p></div>
  </div>
  <div class="spacer"></div>
  ${h.homework && h.homework.length ? `<div class="card" style="border-left:5px solid var(--warn)">
    <h3>📌 先生からの宿題</h3>
    <ul class="list-plain">${h.homework.map(w => {
      const late = !w.done && w.due && w.due < new Date().toLocaleDateString('sv-SE');
      return `<li><a class="unit-item" href="#/unit/${w.unit.id}">
        <span class="unit-status" aria-hidden="true">${w.done ? '✅' : late ? '⏰' : '📌'}</span>
        <div><div class="unit-name">${esc(w.unit.name)}</div>
          <div class="muted">${SUBJ[w.unit.subject].name}${w.due ? '・きげん ' + w.due : ''}${w.note ? '・' + esc(w.note) : ''}${w.done ? '・<strong style="color:var(--good)">クリアずみ！</strong>' : late ? '・<strong style="color:var(--bad)">きげんが すぎているよ</strong>' : ''}</div></div>
        <span class="unit-meta">▶</span></a></li>`; }).join('')}</ul>
    <p class="muted">テストで80点以上とると 宿題クリアだよ。</p>
  </div><div class="spacer"></div>` : ''}
  <div class="grid grid-2">
    <div class="card">
      <h3>🔁 今日の復習 ${h.reviewsDue.length ? `<span class="tag" style="background:var(--brand-soft);color:var(--brand)">${h.reviewsDue.length}件</span>` : ''}</h3>
      ${h.reviewsDue.length ? `<ul class="list-plain">${h.reviewsDue.map(r => `
        <li><a class="unit-item" href="#/unit/${r.unit.id}?mode=review&rid=${r.id}">
          <span class="unit-status" aria-hidden="true">${SUBJ[r.unit.subject].icon}</span>
          <div><div class="unit-name">${esc(r.unit.name)}</div><div class="muted">${GRADE_LABEL(r.unit.grade)}・${r.due}が復習日</div></div>
          <span class="unit-meta">▶</span></a></li>`).join('')}</ul>`
      : '<p class="muted">今日の 復習は ありません。テストに 合格すると、わすれにくい タイミング（翌日・3日後・7日後…）で 自動的に 復習が とどくよ。</p>'}
    </div>
    <div class="card">
      <h3>🚀 今日のおすすめ</h3>
      <ul class="list-plain">
        <li><a class="unit-item" href="#/unit/${h.recommend.id}">
          <span class="unit-status" aria-hidden="true">${SUBJ[h.recommend.subject].icon}</span>
          <div><div class="unit-name">${esc(h.recommend.name)}</div><div class="muted">おすすめ単元</div></div><span class="unit-meta">▶</span></a></li>
        ${h.continueUnit ? `<li><a class="unit-item" href="#/unit/${h.continueUnit.id}">
          <span class="unit-status" aria-hidden="true">⏯</span>
          <div><div class="unit-name">${esc(h.continueUnit.name)}</div><div class="muted">前回のつづきから</div></div><span class="unit-meta">▶</span></a></li>` : ''}
      </ul>
      ${h.weak.length ? `<div class="spacer"></div><h3>💪 にがて単元</h3><ul class="list-plain">${h.weak.map(w => `
        <li><a class="unit-item" href="#/unit/${w.unit.id}">
          <span class="unit-status" aria-hidden="true">${SUBJ[w.unit.subject].icon}</span>
          <div><div class="unit-name">${esc(w.unit.name)}</div><div class="muted">正答率 ${w.acc}%</div></div><span class="unit-meta">▶</span></a></li>`).join('')}</ul>` : ''}
    </div>
  </div>`;
});

/* ================= 学ぶ(教科→学年→単元) ================= */
route(/^\/learn(?:\/(\w+))?(?:\/(\d))?$/, async (subject, grade) => {
  showChrome();
  if (!CURR) CURR = await api('/curriculum');
  if (!subject) {
    main.innerHTML = `<h2 class="page-title">📚 教科を えらぼう</h2>
    <div class="grid grid-3">${Object.entries(SUBJ).map(([k, s]) => {
      const units = CURR.units.filter(u => u.subject === k);
      const cleared = units.filter(u => u.progress?.status === 'cleared').length;
      return `<a class="card subject-card ${s.cls}" href="#/learn/${k}/${ME.grade}" style="text-decoration:none;color:inherit">
        <div class="subject-icon" aria-hidden="true">${s.icon}</div>
        <h3 style="font-size:1.2rem">${s.name}</h3>
        <p class="muted">クリア ${cleared} / ${units.length} 単元</p></a>`;
    }).join('')}</div>`;
    return;
  }
  const g = parseInt(grade) || ME.grade;
  const s = SUBJ[subject];
  const units = CURR.units.filter(u => u.subject === subject && u.grade === g);
  main.innerHTML = `
  <h2 class="page-title"><span aria-hidden="true">${s.icon}</span> ${s.name}</h2>
  <div class="grade-row" role="tablist" aria-label="学年">
    ${[1,2,3,4,5,6].map(x => `<a role="tab" aria-selected="${x===g}" class="grade-chip ${x===g?'active':''}" href="#/learn/${subject}/${x}">小${x}</a>`).join('')}
  </div>
  ${units.length ? `<ul class="list-plain">${units.map(u => {
    const st = u.progress?.status;
    const icon = st === 'cleared' ? '✅' : st === 'practiced' ? '📝' : '⬜';
    const lvName = ['', '初級', '標準', '応用', '発展'][u.progress?.level || 1];
    return `<li><a class="unit-item" href="#/unit/${u.id}" ${u.advanced?'title="学習指導要領の範囲外の先取り学習です"':''}>
      <span class="unit-status" aria-hidden="true">${icon}</span>
      <div><div class="unit-name">${esc(u.name)}</div>
        <div class="muted">${st === 'cleared' ? `クリアずみ・ベスト${u.progress.best}点` : st === 'practiced' ? '練習中' : 'これから'}・レベル: ${lvName}</div></div>
      <span class="unit-meta"><button class="icon-btn fav-btn" data-fav="${u.id}" aria-label="お気に入り">${u.fav ? '⭐' : '☆'}</button> ▶</span></a></li>`;
  }).join('')}</ul>` : `<div class="card"><p>この学年の ${s.name}の 単元は 準備中です。${subject === 'en' && g <= 2 ? '英語は 3年生から 本格的に はじまるよ（1・2年生には「★先取り」単元が あるよ）。' : ''}</p></div>`}`;
  main.querySelectorAll('[data-fav]').forEach(b => b.onclick = async e => {
    e.preventDefault(); e.stopPropagation();
    const r = await api('/favorites/' + b.dataset.fav, { method: 'POST' });
    b.textContent = r.fav ? '⭐' : '☆';
    CURR.units.find(u => u.id === b.dataset.fav).fav = r.fav;
  });
});

/* ================= 単元ページ(学ぶ→練習→テスト→復習→クリア) ================= */
route(/^\/unit\/([\w-]+)(?:\?(.*))?$/, async (unitId, qs) => {
  showChrome();
  if (!CURR) CURR = await api('/curriculum');
  const params = new URLSearchParams(qs || '');
  const unit = CURR.units.find(u => u.id === unitId);
  if (!unit) { location.replace('#/learn'); return; }
  if (params.get('mode') === 'review') { startQuiz(unit, 'review', params.get('rid')); return; }
  const s = SUBJ[unit.subject];
  const st = unit.progress?.status;
  const stepIdx = st === 'cleared' ? 4 : st === 'practiced' ? 2 : 0;
  const steps = [['📖','学ぶ'],['✏️','練習'],['📝','テスト'],['🔁','復習'],['🏆','クリア']];
  main.innerHTML = `
  <p><a class="btn btn-ghost" href="#/learn/${unit.subject}/${unit.grade}">← ${s.name}の単元一覧</a></p>
  <h2 class="page-title"><span class="tag tag-${s.cls}">${s.icon} ${s.name}・${GRADE_LABEL(unit.grade)}</span></h2>
  <h2 style="margin:.1em 0 0;font-size:1.4rem;font-weight:900">${esc(unit.name)}</h2>
  <div class="steps" aria-label="学習のながれ">
    ${steps.map((sp, i) => `<div class="step ${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}">
      <span class="step-dot">${i < stepIdx ? '✓' : sp[0]}</span>${sp[1]}</div>`).join('')}
  </div>
  <div class="note-box">
    <h3 style="margin-top:0">📖 まとめノート ${ttsBtn(unit.note)}</h3>
    <p style="margin-bottom:0">${esc(unit.note)}</p>
  </div>
  <div class="spacer"></div>
  <div class="grid grid-2">
    <div class="card"><h3>✏️ 練習する</h3>
      <p class="muted">今の レベル（${['','初級','標準','応用','発展'][unit.progress?.level || 1]}）に あわせて AIが 問題を えらぶよ。まちがえても だいじょうぶ！</p>
      <button class="btn btn-primary btn-big" id="startPractice">練習を はじめる</button></div>
    <div class="card"><h3>📝 確認テスト</h3>
      <p class="muted">80点以上で クリア！クリアすると 復習が 自動で スケジュールされるよ。${unit.progress?.best ? `ベスト: <strong>${unit.progress.best}点</strong>` : ''}</p>
      <button class="btn btn-big" id="startTest">テストに ちょうせん</button></div>
  </div>`;
  $('#startPractice').onclick = () => startQuiz(unit, 'practice');
  $('#startTest').onclick = () => startQuiz(unit, 'test');
});

/* ---------- クイズ実行 ---------- */
async function startQuiz(unit, mode, reviewId) {
  const data = await api(`/units/${unit.id}/questions?mode=${mode}`);
  const qs = data.questions;
  if (!qs.length) { toast('この単元の問題は準備中です'); return; }
  let idx = 0, correct = 0;
  const results = [];
  const t0 = Date.now();
  const support = ME.settings?.support;
  const modeName = mode === 'test' ? '確認テスト' : mode === 'review' ? 'AI復習' : '練習';

  const renderQ = () => {
    const q = qs[idx];
    main.innerHTML = `
    <div class="quiz-wrap">
      <p class="muted">${esc(unit.name)}・${modeName}（${['','初級','標準','応用','発展'][data.level]}レベル）</p>
      <div class="quiz-progress" aria-label="進行状況 ${idx + 1}/${qs.length}">
        ${qs.map((_, i) => `<span class="qp-dot ${i < idx ? (results[i] ? 'ok' : 'ng') : i === idx ? 'on' : ''}"></span>`).join('')}
      </div>
      <p class="quiz-q">${esc(q.q)} ${ttsBtn(q.q)}</p>
      ${q.t === 'choice'
        ? `<div class="choices" role="group" aria-label="こたえの選択肢">
            ${q.c.map(c => `<button class="choice" data-ans="${esc(c)}">${esc(c)}</button>`).join('')}</div>`
        : `<form id="inputForm">
            <input class="answer-input" id="ansInput" autocomplete="off" inputmode="${/分数|3\/5/.test(q.q) ? 'text' : 'decimal'}" placeholder="こたえを 入力してね" aria-label="こたえ">
            <div class="spacer"></div><button class="btn btn-primary btn-big">こたえる</button></form>`}
      <div id="fb"></div>
      <div class="spacer"></div>
      <button class="btn btn-ghost" id="quitQuiz">やめる</button>
    </div>`;
    if (support && ME.settings?.ttsAuto) speak(q.q);
    $('#quitQuiz').onclick = () => { if (confirm('とちゅうで やめますか？（記録は のこりません）')) location.hash = '#/unit/' + unit.id; };
    const judge = (ans) => {
      const norm = x => String(x).trim().replace(/\s/g, '').replace(/[０-９．／]/g, c => '0123456789./'['０１２３４５６７８９．／'.indexOf(c)]);
      const ok = norm(ans) === norm(q.a);
      results[idx] = ok; if (ok) correct++;
      main.querySelectorAll('.choice').forEach(b => {
        b.disabled = true;
        if (b.dataset.ans === q.a) b.classList.add('correct');
        else if (b.dataset.ans === String(ans) && !ok) b.classList.add('wrong');
      });
      const inp = $('#ansInput'); if (inp) inp.disabled = true;
      $('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'ng'}" role="alert">
        ${ok ? '⭕ せいかい！' : `❌ ざんねん… こたえは「${esc(q.a)}」`}
        <span class="exp">${esc(q.e || '')}</span></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" id="nextQ">${idx + 1 < qs.length ? 'つぎへ ▶' : 'けっかを 見る 🏁'}</button>`;
      if (support && ME.settings?.ttsAuto) speak((ok ? 'せいかい。' : 'ざんねん。') + (q.e || ''));
      $('#nextQ').focus();
      $('#nextQ').onclick = () => { idx++; idx < qs.length ? renderQ() : finish(); };
    };
    main.querySelectorAll('.choice').forEach(b => b.onclick = () => judge(b.dataset.ans));
    const f = $('#inputForm'); if (f) f.onsubmit = e => { e.preventDefault(); const v = $('#ansInput').value; if (v.trim()) judge(v); };
  };

  const finish = async () => {
    const durationSec = Math.round((Date.now() - t0) / 1000);
    const r = await api('/attempts', { method: 'POST', body: { unitId: unit.id, mode, correct, total: qs.length, durationSec, reviewId } });
    CURR = null; // 進捗キャッシュを更新させる
    const cheer = r.score === 100 ? '🎉 パーフェクト！すごい！' : r.score >= 80 ? '✨ よくできました！' : r.score >= 50 ? '💪 いいちょうし！もう一歩！' : '🌱 まちがいは 成長のたね。もう一度 やってみよう！';
    main.innerHTML = `
    <div class="quiz-wrap"><div class="card result-hero">
      <p class="muted">${esc(unit.name)}・${modeName}</p>
      <div class="result-score">${r.score}<small style="font-size:1.2rem">点</small></div>
      <p style="font-weight:800">${cheer}</p>
      ${mode === 'test' ? (r.cleared ? `<p class="tag" style="background:var(--en-soft);color:var(--en);font-size:.9rem">🏆 単元クリア！復習を 自動で よやくしたよ（翌日・3日後・7日後・14日後・30日後）</p>` : `<p class="muted">80点以上で クリア。練習してから もう一度 ちょうせんしよう！</p>`) : ''}
      <p>＋${r.gainedXp} XP　${r.streak ? `🔥 ${r.streak}日れんぞく` : ''}</p>
      ${r.newBadges.map(b => `<div class="badge-pop"><span class="b-icon">${b.icon}</span><strong>${esc(b.name)}</strong><small class="muted">${esc(b.desc)}</small></div>`).join('')}
      <div class="spacer"></div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-big" id="again">もう一回</button>
        <a class="btn btn-big" href="#/unit/${unit.id}">単元にもどる</a>
        <a class="btn btn-big" href="#/home">ホームへ</a>
      </div>
    </div></div>`;
    $('#again').onclick = () => startQuiz(unit, mode);
  };
  renderQ();
}

/* ================= 復習一覧 ================= */
route(/^\/reviews$/, async () => {
  showChrome();
  if (!CURR) CURR = await api('/curriculum');
  const r = await api('/reviews');
  main.innerHTML = `<h2 class="page-title">🔁 復習スケジュール</h2>
  <p class="muted">わすれかけた ころに 復習すると、記憶は いちばん 強くなるよ（忘却曲線）。テストに合格した単元が 翌日→3日後→7日後→14日後→30日後に とどきます。</p>
  ${r.reviews.length ? `<ul class="list-plain">${r.reviews.map(v => `
    <li><a class="unit-item" href="#/unit/${v.unit.id}?mode=review&rid=${v.id}">
      <span class="unit-status" aria-hidden="true">${v.overdue ? '🔔' : '📅'}</span>
      <div><div class="unit-name">${esc(v.unit.name)}</div>
        <div class="muted">${SUBJ[v.unit.subject].name}・${GRADE_LABEL(v.unit.grade)}・${v.overdue ? '<strong style="color:var(--warn)">今日 復習しよう！</strong>' : v.due + ' に復習'}</div></div>
      <span class="unit-meta">▶</span></a></li>`).join('')}</ul>`
  : `<div class="card"><p>予定されている 復習は ありません。単元テストに 合格すると 自動で 復習が 予約されるよ。</p><a class="btn btn-primary" href="#/learn">単元を さがす</a></div>`}`;
});

/* ================= マイページ ================= */
route(/^\/mypage$/, async () => {
  showChrome();
  const m = await api('/mypage');
  const pct = Math.min(100, Math.round((m.xp - m.levelBaseXp) / (m.nextLevelXp - m.levelBaseXp) * 100));
  // 学習カレンダー(直近60日)
  const days = [];
  const map = Object.fromEntries(m.calendar.map(c => [c.d, c.n]));
  for (let i = 59; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toLocaleDateString('sv-SE'); const n = map[k] || 0; days.push(`<i class="${n >= 20 ? 'l3' : n >= 10 ? 'l2' : n >= 1 ? 'l1' : ''}" title="${k}: ${n}問"></i>`); }
  const allBadges = Object.entries(m.badgeDefs);
  const earned = new Set(m.badges.map(b => b.id));
  main.innerHTML = `
  <h2 class="page-title">🧑‍🚀 マイページ</h2>
  <div class="grid grid-3">
    <div class="card"><h3>⭐ レベル</h3><div class="stat">Lv.${m.level}</div>
      <div class="xp-bar"><i style="width:${pct}%"></i></div><p class="muted">${m.xp} XP（次まで あと${m.nextLevelXp - m.xp}）</p></div>
    <div class="card"><h3>⏱ 合計学習時間</h3><div class="stat">${fmtMin(m.totalSec)}</div><p class="muted">🔥 れんぞく ${m.streak}日</p></div>
    <div class="card"><h3>🎯 全体の正答率</h3><div class="stat">${m.acc == null ? '—' : m.acc + '<small>%</small>'}</div>
      <p class="muted">${ME.grade}年生の達成率 ${m.gradeCleared}/${m.gradeTotal} 単元</p></div>
  </div>
  <div class="spacer"></div>
  <div class="ai-note"><span class="a-icon" aria-hidden="true">🤖</span><div><strong>こぶこぶ先生の 分析</strong><br>${esc(m.aiComment)}</div></div>
  <div class="grid grid-2">
    <div class="card"><h3>📅 学習カレンダー（60日）</h3><div class="cal">${days.join('')}</div></div>
    <div class="card"><h3>🏅 バッジ（${earned.size}/${allBadges.length}）</h3>
      <div class="badge-grid">${allBadges.map(([id, b]) => `
        <div class="badge-cell ${earned.has(id) ? '' : 'locked'}" title="${esc(b.desc)}">
          <div class="b-icon">${b.icon}</div><div class="b-name">${esc(b.name)}</div></div>`).join('')}</div></div>
    <div class="card"><h3>💪 にがてランキング</h3>
      ${m.weakRank.length ? `<ul class="list-plain">${m.weakRank.map((w, i) => `
        <li><a class="unit-item" href="#/unit/${w.unit.id}"><span class="unit-status">${i + 1}位</span>
        <div><div class="unit-name">${esc(w.unit.name)}</div><div class="muted">正答率 ${w.acc}%</div></div><span class="unit-meta">▶</span></a></li>`).join('')}</ul>` : '<p class="muted">まだ データが たりないよ（各単元5問以上で 表示）</p>'}</div>
    <div class="card"><h3>🌟 とくいランキング</h3>
      ${m.strongRank.length ? `<ul class="list-plain">${m.strongRank.map((w, i) => `
        <li><div class="unit-item" style="cursor:default"><span class="unit-status">${i + 1}位</span>
        <div><div class="unit-name">${esc(w.unit.name)}</div><div class="muted">正答率 ${w.acc}%・${['','初級','標準','応用','発展'][w.level]}レベル</div></div></div></li>`).join('')}</ul>` : '<p class="muted">まだ データが たりないよ</p>'}</div>
  </div>`;
});

/* ================= 設定(支援教育モード含む) ================= */
route(/^\/settings$/, async () => {
  showChrome();
  const s = ME.settings || {};
  const sw = (key, label, desc) => `
    <div class="switch-row"><div><strong>${label}</strong><br><small class="muted">${desc}</small></div>
      <label class="switch"><input type="checkbox" data-set="${key}" ${s[key] ? 'checked' : ''}><i></i></label></div>`;
  main.innerHTML = `
  <h2 class="page-title">⚙️ せってい</h2>
  <div class="grid grid-2">
    <div class="card"><h3>🏫 クラス</h3>
      <p>${ME.classCode ? `いま <strong style="letter-spacing:.15em;color:var(--brand)">${esc(ME.classCode)}</strong> の クラスに 入っているよ。` : 'まだ クラスに 入っていないよ。先生から クラスコードを もらったら 入れてね。'}</p>
      <label class="field"><span>クラスコード</span><input id="joinCode" maxlength="8" placeholder="例：AB3D" style="text-transform:uppercase"></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" id="joinGo">クラスに 入る</button>
        ${ME.classCode ? '<button class="btn" id="leaveCls">クラスから ぬける</button>' : ''}
      </div>
    </div>
    <div class="card"><h3>👤 プロフィール</h3>
      <form id="profForm">
        <label class="field"><span>なまえ</span><input name="name" value="${esc(ME.name)}" maxlength="30"></label>
        <label class="field"><span>学年</span><select name="grade">${[1,2,3,4,5,6].map(g => `<option value="${g}" ${g === ME.grade ? 'selected' : ''}>小学${g}年生</option>`).join('')}</select></label>
        <label class="field"><span>メールアドレス</span><input name="email" type="email" value="${esc(ME.email)}"></label>
        <button class="btn btn-primary">保存する</button>
      </form>
      <div class="spacer"></div>
      <details><summary style="cursor:pointer;font-weight:700">パスワードを 変更する</summary>
        <form id="passForm" style="margin-top:10px">
          <label class="field"><span>現在のパスワード</span><input name="current" type="password" required></label>
          <label class="field"><span>新しいパスワード（8文字以上）</span><input name="next" type="password" required minlength="8"></label>
          <button class="btn">変更する</button>
        </form></details>
      <div class="spacer"></div>
      <button class="btn" id="logoutBtn">ログアウト</button>
    </div>
    <div class="card"><h3>🖥 表示</h3>
      ${sw('dark', 'ダークモード', '目に やさしい くらい画面')}
      <div class="switch-row"><div><strong>文字の大きさ</strong></div>
        <select data-setval="fontSize"><option value="">ふつう</option><option value="large" ${s.fontSize==='large'?'selected':''}>大きい</option><option value="xl" ${s.fontSize==='xl'?'selected':''}>とても大きい</option></select></div>
      <div class="switch-row"><div><strong>背景の色</strong><br><small class="muted">まぶしさが 気になる ときに</small></div>
        <select data-setval="bg"><option value="">しろ</option><option value="cream" ${s.bg==='cream'?'selected':''}>クリーム</option><option value="mint" ${s.bg==='mint'?'selected':''}>ミント</option><option value="sky" ${s.bg==='sky'?'selected':''}>そら色</option></select></div>
    </div>
    <div class="card"><h3>🤝 支援教育モード</h3>
      <p class="muted">「誰一人取り残さない学び」のための せっていです。必要なものだけ ONに できます。</p>
      ${sw('support', '支援モードを つかう', '問題数を へらし、ゆっくり ていねいに 学べる')}
      ${sw('fewerChoices', 'えらぶ数を へらす', '四択 → 二択に して 集中しやすく（支援モードON時）')}
      ${sw('ttsAuto', '問題を 自動で 読み上げ', '問題と 解説を 音声で 読み上げる')}
      <div class="switch-row"><div><strong>読み上げの速さ</strong></div>
        <select data-setval="ttsRate"><option value="0.75" ${s.ttsRate==0.75?'selected':''}>ゆっくり</option><option value="0.95" ${!s.ttsRate||s.ttsRate==0.95?'selected':''}>ふつう</option><option value="1.2" ${s.ttsRate==1.2?'selected':''}>はやい</option></select></div>
      ${sw('focus', '集中モード', 'メニューや チャットボタンを かくして 学習に 集中')}
      <p class="muted">🔊 読み上げは 端末の 音声機能（Web Speech API）を つかいます。問題文に 読みがなを つける 総ルビ機能は 今後の アップデートで 対応予定です。</p>
    </div>
  </div>`;
  $('#joinGo').onclick = async () => {
    const code = $('#joinCode').value.trim().toUpperCase();
    if (!code) { toast('クラスコードを 入れてね'); return; }
    try { const r = await api('/class/join', { method: 'POST', body: { code } }); ME.classCode = r.code; toast(`${r.teacherName}のクラスに 入りました！`); navigate(); }
    catch (e) { toast(e.message); }
  };
  const leaveBtn = $('#leaveCls');
  if (leaveBtn) leaveBtn.onclick = async () => {
    if (!confirm('クラスから ぬけますか？（学習の記録は のこります）')) return;
    await api('/class/leave', { method: 'POST' }); ME.classCode = null; toast('クラスから ぬけました'); navigate();
  };
  const save = async (patch) => {
    ME.settings = Object.assign({}, ME.settings, patch);
    applySettings();
    await api('/auth/profile', { method: 'PUT', body: { settings: ME.settings } });
    toast('設定を ほぞんしました');
  };
  main.querySelectorAll('[data-set]').forEach(el => el.onchange = () => save({ [el.dataset.set]: el.checked }));
  main.querySelectorAll('[data-setval]').forEach(el => el.onchange = () => save({ [el.dataset.setval]: el.dataset.setval === 'ttsRate' ? parseFloat(el.value) : el.value }));
  $('#profForm').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await api('/auth/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      ME = Object.assign(ME, r.user); toast('プロフィールを 更新しました');
    } catch (err) { toast(err.message); }
  };
  $('#passForm').onsubmit = async e => {
    e.preventDefault();
    try { await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('パスワードを 変更しました'); e.target.reset(); }
    catch (err) { toast(err.message); }
  };
  $('#logoutBtn').onclick = async () => { await api('/auth/logout', { method: 'POST' }); ME = null; location.hash = '#/login'; };
});

/* ================= 教員用 ================= */
route(/^\/t\/setup$/, async () => {
  showChrome();
  main.innerHTML = `
  <div class="auth-wrap"><div class="card">
    <h3>🏫 クラスを 用意しましょう</h3>
    <p class="muted">新しいクラスを作ると 4文字のクラスコードが発行されます。生徒がそのコードを入力すると あなたのクラスに参加します。</p>
    <button class="btn btn-primary btn-big" id="clsCreate" style="width:100%">新しいクラスを 作る</button>
    <div class="spacer"></div>
    <details><summary style="cursor:pointer;font-weight:700">すでにあるクラスに 参加する（学年団などで共同管理）</summary>
      <label class="field" style="margin-top:10px"><span>クラスコード</span><input id="clsJoin" maxlength="8" placeholder="例：AB3D" style="text-transform:uppercase"></label>
      <button class="btn" id="clsJoinGo">このクラスに 参加</button>
    </details>
  </div></div>`;
  $('#clsCreate').onclick = async () => {
    try { const r = await api('/class/create', { method: 'POST' }); ME.classCode = r.code; toast(`クラスを作成しました！コード：${r.code}`); location.hash = '#/t/home'; }
    catch (e) { toast(e.message); }
  };
  $('#clsJoinGo').onclick = async () => {
    const code = $('#clsJoin').value.trim().toUpperCase();
    if (!code) { toast('クラスコードを入力してください'); return; }
    try { const r = await api('/class/join', { method: 'POST', body: { code } }); ME.classCode = r.code; toast('クラスに参加しました'); location.hash = '#/t/home'; }
    catch (e) { toast(e.message); }
  };
});

route(/^\/t\/home$/, async () => {
  showChrome();
  if (!ME.classCode) { location.hash = '#/t/setup'; return; }
  const [{ students }, { homework }] = await Promise.all([api('/teacher/students'), api('/teacher/homework')]);
  main.innerHTML = `
  <h2 class="page-title">👩‍🏫 ${esc(ME.name)}の 教員ダッシュボード</h2>
  <div class="ai-note"><span class="a-icon" aria-hidden="true">🏫</span><div><strong>クラスコード：<span style="font-size:1.35rem;letter-spacing:.2em;color:var(--brand)">${esc(ME.classCode)}</span></strong><br>このコードを生徒に伝えると、あなたのクラスに参加して宿題が届くようになります。</div></div>
  <div class="grid grid-3">
    <div class="card"><h3>🎒 生徒数</h3><div class="stat">${students.length}<small>人</small></div></div>
    <div class="card"><h3>📌 出題中の宿題</h3><div class="stat">${homework.length}<small>件</small></div><a class="btn btn-ghost" href="#/t/homework">宿題を管理 →</a></div>
    <div class="card"><h3>🔥 今日学習した生徒</h3><div class="stat">${students.filter(s => s.todayN > 0).length}<small>人</small></div></div>
  </div>
  <div class="spacer"></div>
  <h3 class="page-title" style="font-size:1.05rem">生徒の取り組み状況</h3>
  ${students.length ? `<ul class="list-plain">${students.map(s => `
    <li><a class="unit-item" href="#/t/student/${s.id}">
      <span class="unit-status" aria-hidden="true">${s.todayN > 0 ? '🟢' : '⚪'}</span>
      <div><div class="unit-name">${esc(s.name)} <small class="muted">小${s.grade}・Lv.${s.level}</small></div>
        <div class="muted">今日 ${s.todayN}問(${fmtMin(s.todaySec)})・正答率 ${s.acc == null ? '—' : s.acc + '%'}・クリア ${s.cleared}単元・🔥${s.streak}日</div></div>
      <span class="unit-meta">▶</span></a></li>`).join('')}</ul>`
  : `<div class="card"><p>まだ このクラスに参加している生徒はいません。生徒が新規登録時、または「せってい」でクラスコード <strong>${esc(ME.classCode)}</strong> を入力すると ここに表示されます。</p></div>`}`;
});

route(/^\/t\/student\/(\d+)$/, async (sid) => {
  showChrome();
  let d;
  try { d = await api('/teacher/student/' + sid); } catch (e) { toast(e.message); location.hash = '#/t/home'; return; }
  const st = d.student, x = d.stats;
  const map = Object.fromEntries(d.calendar.map(c => [c.d, c.n]));
  const days = [];
  for (let i = 27; i >= 0; i--) { const dd = new Date(); dd.setDate(dd.getDate() - i); const k = dd.toLocaleDateString('sv-SE'); const nn = map[k] || 0; days.push(`<i class="${nn >= 20 ? 'l3' : nn >= 10 ? 'l2' : nn >= 1 ? 'l1' : ''}" title="${k}: ${nn}問"></i>`); }
  const today = new Date().toLocaleDateString('sv-SE');
  main.innerHTML = `
  <p><a class="btn btn-ghost" href="#/t/home">← 生徒一覧</a></p>
  <h2 class="page-title">🎒 ${esc(st.name)} <small class="muted">小${st.grade}・Lv.${st.level}（${st.xp} XP）</small></h2>
  <div class="grid grid-3">
    <div class="card"><h3>🎯 正答率</h3><div class="stat">${x.acc == null ? '—' : x.acc + '<small>%</small>'}</div><p class="muted">合計 ${x.totalQ}問</p></div>
    <div class="card"><h3>⏱ 学習時間</h3><div class="stat">${fmtMin(x.totalSec)}</div><p class="muted">🔥 連続 ${x.streak}日</p></div>
    <div class="card"><h3>🏆 達成率(自学年)</h3><div class="stat">${d.gradeCleared}<small>/${d.gradeTotal}単元</small></div></div>
  </div>
  <div class="spacer"></div>
  <div class="grid grid-2">
    <div class="card"><h3>📌 宿題の状況</h3>
      ${d.homework.length ? `<ul class="list-plain">${d.homework.map(h => {
        const late = !h.done && h.due && h.due < today;
        return `<li><div class="unit-item" style="cursor:default">
          <span class="unit-status">${h.done ? '✅' : late ? '⏰' : '⬜'}</span>
          <div><div class="unit-name">${esc(h.unit.name)}</div>
          <div class="muted">${h.due ? '期限 ' + h.due : '期限なし'}・${h.done ? '<strong style="color:var(--good)">完了</strong>' : late ? '<strong style="color:var(--bad)">期限超過</strong>' : '未完了'}</div></div></div></li>`; }).join('')}</ul>`
      : '<p class="muted">この学年に出題中の宿題はありません。</p>'}</div>
    <div class="card"><h3>📅 直近28日の学習</h3><div class="cal" style="grid-template-columns:repeat(14,1fr)">${days.join('')}</div></div>
    <div class="card"><h3>💪 苦手単元(要フォロー)</h3>
      ${d.weak.length ? `<ul class="list-plain">${d.weak.map((w, i) => `
        <li><div class="unit-item" style="cursor:default"><span class="unit-status">${i + 1}位</span>
        <div><div class="unit-name">${esc(w.unit.name)}</div><div class="muted">${SUBJ[w.unit.subject].name}・正答率 ${w.acc}%</div></div></div></li>`).join('')}</ul>` : '<p class="muted">まだ十分なデータがありません（各単元5問以上で表示）。</p>'}</div>
    <div class="card"><h3>🏅 バッジ</h3>
      ${d.badges.length ? d.badges.map(b => `<span class="tag" style="background:var(--brand-soft);color:var(--brand);margin:2px">${b.icon || ''} ${esc(b.name || b.id)}</span>`).join(' ') : '<p class="muted">まだありません。</p>'}</div>
  </div>`;
});

route(/^\/t\/homework$/, async () => {
  showChrome();
  if (!ME.classCode) { location.hash = '#/t/setup'; return; }
  const { homework } = await api('/teacher/homework');
  if (!CURR) CURR = await api('/curriculum');
  const today = new Date().toLocaleDateString('sv-SE');
  main.innerHTML = `
  <h2 class="page-title">📌 宿題の設定・管理 <span class="tag" style="background:var(--brand-soft);color:var(--brand)">クラス ${esc(ME.classCode)}</span></h2>
  <div class="card">
    <h3>➕ 新しい宿題を出す</h3>
    <div class="grid grid-3">
      <label class="field"><span>対象学年</span><select id="hwGrade">${[1,2,3,4,5,6].map(g => `<option value="${g}">小学${g}年生</option>`).join('')}</select></label>
      <label class="field"><span>単元</span><select id="hwUnit"></select></label>
      <label class="field"><span>期限（任意）</span><input id="hwDue" type="date" min="${today}"></label>
    </div>
    <label class="field"><span>ひとことメモ（任意・生徒に表示）</span><input id="hwNote" maxlength="60" placeholder="例：テスト前にがんばろう！"></label>
    <button class="btn btn-primary" id="hwAdd">この内容で宿題を出す</button>
  </div>
  <div class="spacer"></div>
  <h3 class="page-title" style="font-size:1.05rem">出題中の宿題（${homework.length}件）</h3>
  ${homework.length ? `<ul class="list-plain">${homework.map(h => `
    <li><div class="unit-item" style="cursor:default">
      <span class="unit-status" aria-hidden="true">${SUBJ[h.unit.subject].icon}</span>
      <div><div class="unit-name">小${h.grade}：${esc(h.unit.name)}</div>
        <div class="muted">${h.due ? '期限 ' + h.due : '期限なし'}${h.note ? '・' + esc(h.note) : ''}・完了 <strong>${h.done}/${h.total}人</strong></div></div>
      <span class="unit-meta"><button class="btn" data-del="${h.id}" style="color:var(--bad)">削除</button></span></div></li>`).join('')}</ul>`
  : '<div class="card"><p class="muted">まだ宿題はありません。上のフォームから出題できます。</p></div>'}`;
  const fillUnits = () => {
    const g = +$('#hwGrade').value;
    $('#hwUnit').innerHTML = CURR.units.filter(u => u.grade === g)
      .map(u => `<option value="${u.id}">${SUBJ[u.subject].icon} ${esc(u.name)}</option>`).join('');
  };
  fillUnits();
  $('#hwGrade').onchange = fillUnits;
  $('#hwAdd').onclick = async () => {
    try {
      await api('/teacher/homework', { method: 'POST', body: { grade: +$('#hwGrade').value, unitId: $('#hwUnit').value, due: $('#hwDue').value || null, note: $('#hwNote').value.trim() || null } });
      toast('宿題を出しました'); navigate();
    } catch (e) { toast(e.message); }
  };
  main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('この宿題を削除しますか？')) return;
    try { await api('/teacher/homework/' + b.dataset.del, { method: 'DELETE' }); toast('削除しました'); navigate(); }
    catch (e) { toast(e.message); }
  });
});

route(/^\/t\/settings$/, async () => {
  showChrome();
  main.innerHTML = `
  <h2 class="page-title">⚙️ せってい（教員）</h2>
  <div class="grid grid-2">
    <div class="card"><h3>👩‍🏫 プロフィール</h3>
      <p>クラスコード：<strong style="font-size:1.2rem;letter-spacing:.15em;color:var(--brand)">${esc(ME.classCode || '未設定')}</strong></p>
      <form id="profForm">
        <label class="field"><span>お名前</span><input name="name" value="${esc(ME.name)}" maxlength="30"></label>
        <label class="field"><span>メールアドレス</span><input name="email" type="email" value="${esc(ME.email)}"></label>
        <button class="btn btn-primary">保存する</button>
      </form>
      <div class="spacer"></div>
      <details><summary style="cursor:pointer;font-weight:700">パスワードを 変更する</summary>
        <form id="passForm" style="margin-top:10px">
          <label class="field"><span>現在のパスワード</span><input name="current" type="password" required></label>
          <label class="field"><span>新しいパスワード（8文字以上）</span><input name="next" type="password" required minlength="8"></label>
          <button class="btn">変更する</button>
        </form></details>
      <div class="spacer"></div>
      <button class="btn" id="logoutBtn">ログアウト</button>
    </div>
    <div class="card"><h3>🏫 別のクラスに参加</h3>
      <p class="muted">学年団などで共同管理する場合、同じクラスコードを入力すると同じクラスを一緒に管理できます。</p>
      <label class="field"><span>クラスコード</span><input id="tJoin" maxlength="8" style="text-transform:uppercase"></label>
      <button class="btn" id="tJoinGo">参加する</button>
    </div>
  </div>`;
  $('#profForm').onsubmit = async e => {
    e.preventDefault();
    try { const r = await api('/auth/profile', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); ME = Object.assign(ME, r.user); toast('更新しました'); }
    catch (err) { toast(err.message); }
  };
  $('#passForm').onsubmit = async e => {
    e.preventDefault();
    try { await api('/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); toast('パスワードを変更しました'); e.target.reset(); }
    catch (err) { toast(err.message); }
  };
  $('#logoutBtn').onclick = async () => { await api('/auth/logout', { method: 'POST' }); ME = null; location.hash = '#/login'; };
  $('#tJoinGo').onclick = async () => {
    const code = $('#tJoin').value.trim().toUpperCase();
    if (!code) return toast('クラスコードを入力してください');
    try { const r = await api('/class/join', { method: 'POST', body: { code } }); ME.classCode = r.code; toast('参加しました'); navigate(); }
    catch (e) { toast(e.message); }
  };
});

/* ================= チャット ================= */
const navLink = (href, nav, icon, label) => `<a href="${href}" data-nav="${nav}"><span aria-hidden="true">${icon}</span><span class="nav-label">${label}</span></a>`;
function showChrome() {
  $('#topbar').hidden = false;
  const nav = document.querySelector('.topnav');
  if (ME?.role === 'teacher') {
    nav.innerHTML = navLink('#/t/home', 't/home', '👩‍🏫', '生徒一覧') + navLink('#/t/homework', 't/homework', '📌', '宿題') + navLink('#/t/settings', 't/settings', '⚙️', 'せってい');
    $('#chatFab').hidden = true;
  } else {
    nav.innerHTML = navLink('#/home', 'home', '🏠', 'ホーム') + navLink('#/learn', 'learn', '📚', '学ぶ') + navLink('#/reviews', 'reviews', '🔁', '復習') + navLink('#/mypage', 'mypage', '🧑‍🚀', 'マイページ') + navLink('#/settings', 'settings', '⚙️', 'せってい');
    $('#chatFab').hidden = !!(ME?.settings?.focus);
  }
}
let chatLoaded = false;
$('#chatFab').onclick = async () => {
  $('#chatPanel').hidden = false; $('#chatFab').hidden = true;
  if (!chatLoaded) {
    chatLoaded = true;
    const h = await api('/ai/history');
    const body = $('#chatBody');
    if (!h.history.length) addMsg('ai', `こんにちは、${ME.name}さん！こぶこぶ先生だよ😊 勉強の しつもん、なんでも どうぞ！`);
    h.history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'ai', m.content));
    body.scrollTop = body.scrollHeight;
  }
  $('#chatInput').focus();
};
$('#chatClose').onclick = () => { $('#chatPanel').hidden = true; if (ME) $('#chatFab').hidden = !!(ME.settings?.focus); };
function addMsg(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  $('#chatBody').appendChild(d);
  $('#chatBody').scrollTop = 1e9;
}
async function sendChat(text) {
  if (!text.trim()) return;
  addMsg('user', text);
  const typing = document.createElement('div'); typing.className = 'msg ai'; typing.textContent = '…考え中…';
  $('#chatBody').appendChild(typing); $('#chatBody').scrollTop = 1e9;
  try {
    const r = await api('/ai/chat', { method: 'POST', body: { message: text } });
    typing.remove(); addMsg('ai', r.reply);
    if (ME.settings?.ttsAuto) speak(r.reply);
  } catch (e) { typing.remove(); addMsg('ai', 'ごめんね、うまく 答えられなかったよ。もう一度 ためしてね。'); }
}
$('#chatForm').onsubmit = e => { e.preventDefault(); const v = $('#chatInput').value; $('#chatInput').value = ''; sendChat(v); };
$('#chatSuggests').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) sendChat(b.dataset.q); });

/* ================= 起動 ================= */
(async function init() {
  try { const r = await api('/auth/me'); ME = r.user; applySettings(); } catch { ME = null; }
  navigate();
})();
