// Will's Terranium: shared config + transport for draw.html and index.html.
//
// Paste the Firebase Realtime Database URL here, e.g.
//   https://wills-terranium-default-rtdb.europe-west1.firebasedatabase.app
// Left empty, both pages run in TEST MODE: tabs in the same browser talk to
// each other via BroadcastChannel + localStorage (nothing leaves the device).
const TERRA_DB = 'https://wills-terranium-default-rtdb.europe-west1.firebasedatabase.app';

// Password behind the "GOD MODE" button on the display page (case-insensitive).
const TERRA_WILL_PASS = 'Sykes';

const Terra = (() => {
  const db = TERRA_DB.trim().replace(/\/+$/, '');
  const local = !db;
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('terranium') : null;
  const LS = 'terranium_local_creatures';

  const lsAll = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const lsSave = o => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} };

  // creature = {n: name, s: [{c: colour, w: width, p: "x,y,x,y,..."}], w, h, vw, t}
  async function send(creature) {
    if (local) {
      const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const data = { ...creature, t: Date.now() };
      const all = lsAll(); all[id] = data; lsSave(all);
      bc && bc.postMessage({ type: 'add', id, data });
      return id;
    }
    const r = await fetch(db + '/creatures.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...creature, t: { '.sv': 'timestamp' } }),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.json()).name;
  }

  // onAdd(id, data, isInitial), onRemove(id | '*'), onStatus('live' | 'reconnecting' | 'local')
  function subscribe(onAdd, onRemove, onStatus = () => {}) {
    if (local) {
      const all = lsAll();
      for (const id in all) onAdd(id, all[id], true);
      if (bc) bc.onmessage = e => {
        const m = e.data;
        if (m.type === 'add') onAdd(m.id, m.data, false);
        if (m.type === 'clear') onRemove('*');
        if (m.type === 'remove') onRemove(m.id);
      };
      onStatus('local');
      return;
    }
    let first = true;
    const es = new EventSource(db + '/creatures.json');
    const handle = ev => {
      const m = JSON.parse(ev.data);
      if (!m) return;
      const parts = m.path.split('/').filter(Boolean);
      if (parts.length === 0) {
        if (m.data === null && ev.type === 'put') onRemove('*');
        else for (const id in m.data || {}) m.data[id] === null ? onRemove(id) : onAdd(id, m.data[id], first);
        first = false;
      } else if (parts.length === 1) {
        m.data === null ? onRemove(parts[0]) : onAdd(parts[0], m.data, first);
      }
    };
    es.addEventListener('put', handle);
    es.addEventListener('patch', handle);
    es.onopen = () => onStatus('live');
    es.onerror = () => onStatus('reconnecting');
  }

  async function clear(ids) {
    if (local) { lsSave({}); bc && bc.postMessage({ type: 'clear' }); return; }
    await Promise.all(ids.map(id => fetch(`${db}/creatures/${id}.json`, { method: 'DELETE' })));
  }

  async function remove(id) {
    if (local) { const all = lsAll(); delete all[id]; lsSave(all); bc && bc.postMessage({ type: 'remove', id }); return; }
    const r = await fetch(`${db}/creatures/${id}.json`, { method: 'DELETE' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  // Swap a creature for an edited copy (rules allow create + delete, never overwrite).
  // The new id is made here so the caller can recognise it when it streams back.
  function replace(oldId, data) {
    const id = 'X' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (local) {
      const all = lsAll(); delete all[oldId]; all[id] = data; lsSave(all);
      if (bc) { bc.postMessage({ type: 'remove', id: oldId }); bc.postMessage({ type: 'add', id, data }); }
      return { id, done: Promise.resolve() };
    }
    const done = fetch(`${db}/creatures/${id}.json`, { method: 'PUT', body: JSON.stringify(data) })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return fetch(`${db}/creatures/${oldId}.json`, { method: 'DELETE' }); });
    return { id, done };
  }

  // Rude-doodle check: does the silhouette look like a long even shaft with two
  // round lobes at the wide end and a blunt tip? Orientation-free. Errs on the side
  // of catching the classic doodle; the display has a manual override both ways.
  function looksRude(strokes, w, h, debug = false) {
    const N = 96, k = (N - 8) / Math.max(w, h, 1);
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const c = cv.getContext('2d');
    for (const s of strokes) {
      c.lineWidth = Math.max(3, s.w * k + 2); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = '#000';
      const p = s.p, X = i => p[i] * k + 4, Y = i => p[i + 1] * k + 4;
      c.beginPath(); c.moveTo(X(0), Y(0));
      if (p.length <= 2) c.lineTo(X(0) + 0.1, Y(0));
      for (let i = 2; i < p.length; i += 2) c.lineTo(X(i), Y(i));
      c.stroke();
    }
    const px = c.getImageData(0, 0, N, N).data;
    const ink = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) ink[i] = px[i * 4 + 3] > 40 ? 1 : 0;
    // flood the outside; everything not reached is the filled silhouette
    const out = new Uint8Array(N * N), stack = [];
    for (let i = 0; i < N; i++) stack.push(i, N * (N - 1) + i, i * N, i * N + N - 1);
    while (stack.length) {
      const i = stack.pop();
      if (i < 0 || i >= N * N || out[i] || ink[i]) continue;
      out[i] = 1;
      const x = i % N;
      stack.push(i + N, i - N);
      if (x > 0) stack.push(i - 1);
      if (x < N - 1) stack.push(i + 1);
    }
    const pts = [];
    for (let i = 0; i < N * N; i++) if (!out[i]) pts.push(i % N, (i / N) | 0);
    const n = pts.length / 2;
    if (n < 60) return false;
    let mx = 0, my = 0;
    for (let i = 0; i < pts.length; i += 2) { mx += pts[i]; my += pts[i + 1]; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < pts.length; i += 2) { const dx = pts[i] - mx, dy = pts[i + 1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    sxx /= n; syy /= n; sxy /= n;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
    if (Math.sqrt(l1 / l2) < 1.5) return false;                 // not elongated
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), cs = Math.cos(th), sn = Math.sin(th);
    const B = 24, U = [], V = [];
    let umin = Infinity, umax = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] - mx, dy = pts[i + 1] - my, u = dx * cs + dy * sn;
      U.push(u); V.push(Math.round(-dx * sn + dy * cs));
      if (u < umin) umin = u; if (u > umax) umax = u;
    }
    const bins = Array.from({ length: B }, () => []);
    for (let i = 0; i < U.length; i++) bins[Math.min(B - 1, ((U[i] - umin) / (umax - umin + 1e-6) * B) | 0)].push(V[i]);
    const stat = bins.map(vs => {
      if (!vs.length) return { w: 0, runs: 0 };
      const u = [...new Set(vs)].sort((a, b) => a - b);
      let runs = 1, runLen = 1, longRuns = 0;
      for (let i = 1; i < u.length; i++) {
        if (u[i] - u[i - 1] > 1) { if (runLen >= 2) longRuns++; runs++; runLen = 1; } else runLen++;
      }
      if (runLen >= 2) longRuns++;
      return { w: u[u.length - 1] - u[0] + 1, runs: longRuns };
    });
    const avg = a => a.reduce((s, x) => s + x.w, 0) / a.length;
    if (avg(stat.slice(B - 6)) > avg(stat.slice(0, 6))) stat.reverse();   // wide end first
    const shaft = stat.slice(Math.round(B * 0.4), Math.round(B * 0.8)).map(s => s.w).sort((a, b) => a - b);
    const shaftW = shaft[shaft.length >> 1];
    if (shaftW < 3) return false;
    const mean = shaft.reduce((a, b) => a + b, 0) / shaft.length;
    const sd = Math.sqrt(shaft.reduce((a, b) => a + (b - mean) ** 2, 0) / shaft.length);
    const baseW = Math.max(...stat.slice(0, Math.round(B * 0.3)).map(s => s.w));
    const lobes = stat.slice(0, Math.round(B * 0.22)).some(s => s.runs >= 2);
    let shaftLen = 0;
    for (let i = B - 2; i >= 0 && stat[i].w <= shaftW * 1.3 && stat[i].w > 0; i--) shaftLen++;
    // blunt tip: still near full width close to the end (a rocket's nose cone tapers early)
    const tipOK = stat[Math.round(B * 0.85)].w >= shaftW * 0.85 && stat[Math.round(B * 0.92)].w >= shaftW * 0.7;
    const verdict = baseW >= shaftW * 1.45 && sd / mean < 0.35 && lobes && shaftLen >= B * 0.4 && tipOK;
    return debug ? { verdict, shaftW, baseW, cv: sd / mean, lobes, shaftLen, widths: stat.map(s => s.w).join(' '), runs: stat.map(s => s.runs).join('') } : verdict;
  }

  // Shared renderer: smooth round-capped stroke, offset/scaled.
  function drawStroke(ctx, s, pts, k = 1, ox = 0, oy = 0, widthBoost = 0, colour = null) {
    ctx.strokeStyle = ctx.fillStyle = colour || s.c;
    const w = s.w * k + widthBoost;
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const X = i => pts[i] * k + ox, Y = i => pts[i + 1] * k + oy;
    if (pts.length <= 2) { ctx.beginPath(); ctx.arc(X(0), Y(0), w / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    for (let i = 2; i < pts.length - 2; i += 2) {
      ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 2)) / 2, (Y(i) + Y(i + 2)) / 2);
    }
    ctx.lineTo(X(pts.length - 2), Y(pts.length - 2));
    ctx.stroke();
  }

  return { local, send, subscribe, clear, remove, replace, looksRude, drawStroke };
})();
