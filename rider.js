/* Vento — noyau partagé : physique du vélo, zones, détection des côtes, profil du cycliste.
   Le profil est calculé par training.html et stocké dans localStorage ("vento.rider"). */
const Rider = (() => {
  const G = 9.80665, RHO = 1.2, EFF = .97;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Vitesse (m/s) d'un cycliste qui pédale à P watts. vw = vent de face (m/s, négatif = dans le dos). */
  function solveSpeed(P, m, cda, crr, grade, vw) {
    const th = Math.atan(grade), A = m * G * (crr * Math.cos(th) + Math.sin(th));
    const f = v => { const va = v + vw; return P * EFF - v * (A + .5 * RHO * cda * va * Math.abs(va)); };
    let lo = .3, hi = 15;
    if (f(lo) <= 0) return 1.4;
    if (f(hi) > 0) return hi;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  /** CdA estimé depuis un point (vitesse m/s, puissance W) sur le plat, sans vent. */
  const cdaFrom = (P, m, crr, v) => (P * EFF - m * G * crr * v) / (.5 * RHO * v ** 3);

  const POWER_ZONES = [
    { n: 'Z1 Récupération', lo: 0, hi: .55, c: '#94a3b8' }, { n: 'Z2 Endurance', lo: .56, hi: .75, c: '#38bdf8' },
    { n: 'Z3 Tempo', lo: .76, hi: .90, c: '#4ade80' }, { n: 'Z4 Seuil', lo: .91, hi: 1.05, c: '#fbbf24' },
    { n: 'Z5 VO₂max', lo: 1.06, hi: 1.20, c: '#fb923c' }, { n: 'Z6 Anaérobie', lo: 1.21, hi: 1.50, c: '#f43f5e' },
    { n: 'Z7 Sprint', lo: 1.51, hi: 3, c: '#c026d3' }
  ];
  const HR_ZONES = [
    { n: 'Z1', lo: .50, hi: .60 }, { n: 'Z2', lo: .60, hi: .70 }, { n: 'Z3', lo: .70, hi: .80 }, { n: 'Z4', lo: .80, hi: .90 }, { n: 'Z5', lo: .90, hi: 1 }
  ];
  const powerZone = (w, ftp) => { const r = w / ftp; return r < .56 ? 0 : r < .76 ? 1 : r < .91 ? 2 : r < 1.06 ? 3 : r < 1.21 ? 4 : r < 1.51 ? 5 : 6; };

  /** Niveaux d'effort proposés dans le planificateur. */
  const EFFORTS = {
    easy: { label: 'Facile (≈ 62 % FTP)', f: .62 }, endurance: { label: 'Endurance (≈ 72 % FTP)', f: .72 },
    tempo: { label: 'Tempo (≈ 85 % FTP)', f: .85 }, max: { label: 'À fond (limite de durée)', f: 1 }
  };
  /** Puissance maintenable en fonction de la durée (1 h = FTP, −6 % par doublement ≈ ln). */
  const durability = T => clamp(1 - .06 * Math.log(T / 3600), .55, 1.08);
  function targetPower(ftp, effort, T) {
    const cap = ftp * durability(T);
    return Math.round(effort === 'max' ? cap : Math.min(ftp * (EFFORTS[effort]?.f ?? .72), cap));
  }

  /** Détecte les montées dans un profil d'altitude régulièrement échantillonné (pas en mètres). */
  function detectClimbs(alt, step, minLen = 500, minGain = 25, minGrade = .03) {
    const n = alt.length, out = [], win = Math.max(1, Math.round(300 / step));
    const g = i => { const a = Math.max(0, i - win), b = Math.min(n - 1, i + win); return b > a ? (alt[b] - alt[a]) / ((b - a) * step) : 0; };
    let i = 0;
    while (i < n - 1) {
      if (g(i) >= minGrade) {
        let peak = i, j = i;
        while (j < n - 1) { j++; if (alt[j] > alt[peak]) peak = j; else if (alt[peak] - alt[j] > 8 || (j - peak) * step > 300) break; }
        let st = i; const floor = out.length ? out[out.length - 1].i1 : 0;
        while (st > floor && alt[st - 1] < alt[st] && (i - st) * step < 300) st--;
        const len = (peak - st) * step, gain = alt[peak] - alt[st];
        if (len >= minLen && gain >= minGain && gain / len >= minGrade) out.push({ i0: st, i1: peak, len, gain, grade: gain / len });
        i = Math.max(j, peak + 1);
      } else i++;
    }
    return out;
  }
  /** Catégorie « à la Strava » : longueur (m) × pente (%) */
  function climbCat(len, grade) {
    const s = len * grade * 100;
    return s >= 80000 ? { n: 'HC', c: '#c026d3' } : s >= 64000 ? { n: 'Cat 1', c: '#f43f5e' } : s >= 32000 ? { n: 'Cat 2', c: '#fb923c' }
      : s >= 16000 ? { n: 'Cat 3', c: '#fbbf24' } : s >= 8000 ? { n: 'Cat 4', c: '#4ade80' } : { n: 'Non cat.', c: '#94a3b8' };
  }

  const KEY = 'vento.rider';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch {} };
  const clear = () => { try { localStorage.removeItem(KEY); } catch {} };

  return { solveSpeed, cdaFrom, POWER_ZONES, HR_ZONES, powerZone, EFFORTS, durability, targetPower, detectClimbs, climbCat, load, save, clear, G, RHO, EFF };
})();
