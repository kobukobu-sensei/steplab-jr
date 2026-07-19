// STEP LAB. Jr. Service Worker — アプリシェルのキャッシュ + オフライン時フォールバック
const CACHE = 'steplab-jr-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icon.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) {
    // APIはネットワーク優先。オフライン時はJSONでエラーを返す(通信回復後に再取得)。
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: 'オフラインです。通信がもどったら もう一度 ためしてね。' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // 静的ファイルはキャッシュ優先 + バックグラウンド更新
  e.respondWith(caches.match(e.request).then(hit => {
    const fetched = fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit || caches.match('/index.html'));
    return hit || fetched;
  }));
});
