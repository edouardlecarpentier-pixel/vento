// Service worker : met en cache la coquille de l'app (pas les API) et reçoit les fichiers GPX partagés depuis Android.
const CACHE = 'vento-v17';
const SHELL = ['./', './index.html', './training.html', './rider.js', './sync.js', './fold.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'vento-share').map(k => caches.delete(k)))).then(() => self.clients.claim())));

// « Partager » un .gpx vers Vento (Garmin Connect, Strava, WhatsApp, Fichiers…) : on garde le fichier puis on ouvre l'app qui l'importe.
async function receiveSharedGpx(req) {
  try {
    const fd = await req.formData(), f = fd.get('gpx');
    if (f && f.text) { const c = await caches.open('vento-share'); await c.put(new URL('shared.gpx', self.registration.scope).href, new Response(await f.text())); }
  } catch (e) { /* on redirige quand même */ }
  return Response.redirect(new URL('index.html?shared=1', self.registration.scope).href, 303);
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/index.html')) { e.respondWith(receiveSharedGpx(e.request)); return; }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
