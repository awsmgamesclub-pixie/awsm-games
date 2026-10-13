// Will's Terranium: shared config + transport for draw.html and index.html.
//
// Paste the Firebase Realtime Database URL here, e.g.
//   https://wills-terranium-default-rtdb.europe-west1.firebasedatabase.app
// Left empty, both pages run in TEST MODE: tabs in the same browser talk to
// each other via BroadcastChannel + localStorage (nothing leaves the device).
const TERRA_DB = 'https://wills-terranium-default-rtdb.europe-west1.firebasedatabase.app';

// Password for the hidden "empty the tank" action (tap the title 5x on the tank).
const TERRA_CLEAR_PASS = 'awsm2026';

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

  return { local, send, subscribe, clear, drawStroke };
})();
