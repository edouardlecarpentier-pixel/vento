/* Vento — synchronisation entre appareils (téléphone ↔ PC).
   Les données (maison, travail, vélo-taf, parcours sauvegardés, profil) sont chiffrées dans le navigateur
   (AES-256-GCM, clé dérivée de ta phrase secrète) puis stockées dans un Gist SECRET de ton compte GitHub.
   Strava : seuls le Client ID / Secret de ton application sont synchronisés (chiffrés) ; les jetons de connexion restent sur chaque appareil. */
const VSync = (() => {
  const KEYS = ['vento.places', 'vento.commute', 'vento.routes', 'vento.profile', 'vento.rider', 'vento.stravaApp'];
  const CFG = 'vento.sync.cfg', TS = 'vento.sync.ts', DESC = 'Vento sync (données chiffrées)', FILE = 'vento-sync.json';
  const ls = localStorage, rawSet = Storage.prototype.setItem, rawDel = Storage.prototype.removeItem;
  const jget = (k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };
  const jset = (k, v) => rawSet.call(ls, k, JSON.stringify(v));
  const cfg = () => jget(CFG, {}), saveCfg = c => jset(CFG, c);
  let applying = false, busy = false, again = false, timer = null, state = { msg: '', err: false };

  /* ---- suivi des modifications locales (horodatage par clé) ---- */
  const touch = k => { const ts = jget(TS, {}); ts[k] = Date.now(); jset(TS, ts); };
  Storage.prototype.setItem = function (k, v) {
    if (this === ls && !applying && KEYS.includes(k)) {
      const changed = ls.getItem(k) !== String(v); rawSet.call(this, k, v);
      if (changed) { touch(k); schedule(); }
      return;
    }
    return rawSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    const had = this === ls && ls.getItem(k) !== null; rawDel.call(this, k);
    if (had && !applying && KEYS.includes(k)) { touch(k); schedule(); }
  };

  /* ---- chiffrement ---- */
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function deriveKey(pass, salt) {
    const m = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveKey(pass, salt), te.encode(JSON.stringify(obj)));
    return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) };
  }
  async function decrypt(box, pass) {
    try { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await deriveKey(pass, unb64(box.salt)), unb64(box.data)))); }
    catch { throw new Error('Phrase secrète incorrecte pour ces données.'); }
  }

  /* ---- API GitHub (Gist secret) ---- */
  async function gh(c, path, opt = {}) {
    const r = await fetch('https://api.github.com' + path, { ...opt, headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } });
    if (r.status === 401) throw new Error('Jeton GitHub refusé (expiré ou incorrect).');
    if (r.status === 403) throw new Error('GitHub refuse l\'accès (limite atteinte ou jeton sans la permission « gist »).');
    if (!r.ok) { const e = new Error('GitHub a répondu ' + r.status); e.status = r.status; throw e; }
    return r.json();
  }
  async function findGist(c) {
    if (c.gistId) { try { return await gh(c, '/gists/' + c.gistId); } catch (e) { if (e.status !== 404) throw e; } }
    for (let page = 1; page <= 3; page++) {
      const list = await gh(c, `/gists?per_page=100&page=${page}`), g = list.find(x => x.description === DESC && x.files?.[FILE]);
      if (g) return await gh(c, '/gists/' + g.id);
      if (list.length < 100) break;
    }
    return null;
  }

  /* ---- fusion (fonction pure, testable) ---- */
  function merge(local, remote) {            // local : {k:{val,ts}}, remote : {k:{val,ts}}
    const apply = {}, out = {}; let push = false;
    for (const k of KEYS) {
      const l = local[k], r = remote?.[k];
      if (k === 'vento.routes' && l?.val && r?.val) {          // parcours sauvegardés : réunion par identifiant
        let a = [], b = []; try { a = JSON.parse(l.val); b = JSON.parse(r.val); } catch {}
        const seen = new Map(); [...b, ...a].forEach(x => { if (x && x.id && !seen.has(x.id)) seen.set(x.id, x); });
        const val = JSON.stringify([...seen.values()].sort((x, y) => String(y.id).localeCompare(String(x.id))).slice(0, 60)), ts = Math.max(l.ts || 0, r.ts || 0) || Date.now();
        if (val !== l.val) apply[k] = { val, ts };
        if (val !== r.val) push = true;
        out[k] = { val, ts }; continue;
      }
      if (r && (r.ts || 0) > ((l && l.ts) || 0)) { apply[k] = r; out[k] = r; continue; }
      if (l && (l.val !== null || l.ts)) { out[k] = { val: l.val, ts: l.ts || Date.now() }; if (!r || r.val !== l.val) push = true; }
      else if (r) out[k] = r;
    }
    return { apply, out, push };
  }
  function snapshot() {
    const ts = jget(TS, {}), s = {};
    for (const k of KEYS) { const v = ls.getItem(k); if (v !== null || ts[k]) s[k] = { val: v, ts: ts[k] || 0 }; }
    return s;
  }

  /* ---- synchronisation ---- */
  function emit(msg, err = false) {
    state = { msg, err };
    const a = document.getElementById('syncState'), t = document.getElementById('syncTag');
    if (a) { a.textContent = msg; a.style.color = err ? '#f59e0b' : ''; }
    if (t) t.textContent = err ? '⚠' : (cfg().token ? '●' : '');
  }
  const hhmm = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  function schedule() { if (!cfg().token) return; clearTimeout(timer); timer = setTimeout(() => sync('change'), 4000); }
  async function sync(reason = 'manual') {
    const c = cfg(); if (!c.token || !c.pass) return;
    if (busy) { again = true; return; }
    busy = true; emit('Synchronisation…');
    try {
      const gist = await findGist(c); let remote = null;
      if (gist) {
        const f = gist.files?.[FILE];
        if (f) { const text = f.truncated ? await (await fetch(f.raw_url)).text() : f.content; remote = (await decrypt(JSON.parse(text), c.pass)).keys; }
      }
      const { apply, out, push } = merge(snapshot(), remote), ts = jget(TS, {}), changed = Object.keys(apply);
      applying = true;
      try { for (const k of changed) { if (apply[k].val === null) rawDel.call(ls, k); else rawSet.call(ls, k, apply[k].val); ts[k] = apply[k].ts; } } finally { applying = false; }
      if (changed.length) jset(TS, ts);
      if (push || !gist) {
        const body = JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(await encrypt({ v: 1, keys: out }, c.pass)) } } });
        const g = gist ? await gh(c, '/gists/' + gist.id, { method: 'PATCH', body }) : await gh(c, '/gists', { method: 'POST', body });
        if (g.id !== c.gistId) saveCfg({ ...cfg(), gistId: g.id });
      } else if (gist && c.gistId !== gist.id) saveCfg({ ...cfg(), gistId: gist.id });
      emit(`Synchronisé à ${hhmm()} ✓`);
      if (changed.length && reason !== 'change') {                                  // données reçues d'un autre appareil
        const last = +sessionStorage.getItem('vento.sync.reload') || 0;
        if (Date.now() - last > 20000) { sessionStorage.setItem('vento.sync.reload', Date.now()); if (window.toast) window.toast('Données reçues de ton autre appareil — rechargement…'); setTimeout(() => location.reload(), 1200); }
      }
    } catch (e) { console.warn('sync', e); emit('⚠ ' + (e.message || 'Synchronisation impossible'), true); }
    finally { busy = false; if (again) { again = false; schedule(); } }
  }

  /* ---- interface (carte « Synchronisation » de index.html) ---- */
  function download(name, text) {
    const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function initUI() {
    const q = id => document.getElementById(id), c = cfg();
    if (c.token) setTimeout(() => sync('load'), 1500);                       // synchronisation automatique à l'ouverture de n'importe quelle page
    if (!q('syncOn')) return;
    if (c.token) { q('syncToken').placeholder = '••••••••  (enregistré sur cet appareil)'; q('syncPass').placeholder = '••••••••  (enregistrée)'; emit(c.last ? `Dernière synchronisation à ${new Date(c.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Activée.'); }
    q('syncOn').onclick = async () => {
      const cur = cfg(), token = q('syncToken').value.trim() || cur.token, pass = q('syncPass').value || cur.pass;
      if (!token || !pass) return emit('Colle ton jeton GitHub et choisis une phrase secrète.', true);
      if (pass.length < 8) return emit('La phrase secrète doit faire au moins 8 caractères.', true);
      if (!/^[\w-]{20,}$/.test(token)) return emit('Ce jeton n\'a pas le bon format (il commence par ghp_… ou github_pat_…).', true);
      saveCfg({ ...cur, token, pass }); q('syncToken').value = ''; q('syncPass').value = ''; await sync('manual');
    };
    q('syncOff').onclick = () => { rawDel.call(ls, CFG); emit('Synchronisation désactivée sur cet appareil (tes données restent ici et dans le Gist).'); q('syncToken').placeholder = ''; q('syncPass').placeholder = ''; };
    q('bkSave').onclick = () => { const o = {}; for (const k of KEYS) { const v = ls.getItem(k); if (v !== null) o[k] = v; } download('vento-sauvegarde.json', JSON.stringify({ app: 'vento', v: 1, data: o }, null, 1)); };
    q('bkLoad').onclick = () => q('bkFile').click();
    q('bkFile').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const j = JSON.parse(await f.text()); if (j.app !== 'vento' || !j.data) throw new Error('Fichier non reconnu');
        for (const k of KEYS) if (typeof j.data[k] === 'string') ls.setItem(k, j.data[k]);
        emit('Sauvegarde restaurée — rechargement…'); setTimeout(() => location.reload(), 900);
      } catch (err) { emit('⚠ ' + err.message, true); }
    };
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cfg().token) sync('visible'); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI); else initUI();
  return { sync, merge, encrypt, decrypt, KEYS, state: () => state };
})();
