// Forest disco soundtrack: a little dance remix of Happy Birthday (the tune is public domain),
// synthesised live with Web Audio and locked to the same 120 BPM beat the dancers hop to.
// after 2 bars of beat the tune comes in, sung by a different animal each round (cat first, then owl, frog, dog, cow, duck, sheep).
// Music.start() must be called from a click or key press (browsers block sound until then).
const Music = (() => {
  const BPM = 120, SPB = 60 / BPM;          // seconds per beat
  let ac = null, out = null, duck = null, delay = null, noise = null, on = false, timer = 0, next = 0, offset = 0;

  // Happy Birthday in 4/4, two bars a line: [midi note, beats]; 0 = rest
  const G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;
  const TUNE = [
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [C5, 1], [B4, 2], [0, 2],
    [G4, .75], [G4, .25], [A4, 1], [G4, 1], [D5, 1], [C5, 2], [0, 2],
    [G4, .75], [G4, .25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2], [0, 1],
    [F5, .75], [F5, .25], [E5, 1], [C5, 1], [D5, 1], [C5, 2], [0, 2],
  ];
  const NOTES = []; { let b = 0; for (const [n, d] of TUNE) { if (n) NOTES.push({ b, n, d }); b += d; } }
  // one chord root per bar under the tune (C G G C C F C C), as midi bass notes
  const ROOTS = [36, 43, 43, 36, 36, 41, 36, 36];
  const CHORD = { 36: [60, 64, 67], 43: [59, 62, 67], 41: [60, 65, 69] };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function setup(ctx) {
    ac = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    out = ac.createGain(); out.gain.value = 0.8; out.connect(comp); comp.connect(ac.destination);
    duck = ac.createGain(); duck.connect(out);                     // everything but the kick pumps under it
    delay = ac.createDelay(1); delay.delayTime.value = SPB * 0.75;
    const fb = ac.createGain(); fb.gain.value = 0.32; const dl = ac.createGain(); dl.gain.value = 0.25;
    delay.connect(fb); fb.connect(delay); delay.connect(dl); dl.connect(duck);
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const env = (g, t, a, peak, dec, sus = 0.0001) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
  };
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    env(g, t, 0.002, 1, 0.38); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.45);
    duck.gain.setValueAtTime(0.35, t); duck.gain.linearRampToValueAtTime(1, t + 0.22);   // sidechain pump
  }
  function hiss(t, type, f, q, peak, dec) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    env(g, t, 0.002, peak, dec); s.connect(fl); fl.connect(g); g.connect(duck); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
  }
  const hat = (t, open) => hiss(t, 'highpass', 8000, 0.7, open ? 0.18 : 0.12, open ? 0.16 : 0.04);
  const clap = t => { for (const dt of [0, 0.012, 0.024]) hiss(t + dt, 'bandpass', 1400, 1.2, 0.5, 0.12); };
  function synth(t, midi, dur, { type = 'sawtooth', cut = 1200, peak = 0.2, det = 0, fx = false, vib = 0 } = {}) {
    const g = ac.createGain(), fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; fl.Q.value = 2;
    for (const dd of det ? [-det, det] : [0]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = hz(midi); o.detune.value = dd;
      if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + 0.2); }
      o.connect(fl); o.start(t); o.stop(t + dur + 0.2);
    }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.setValueAtTime(peak, t + Math.max(0.02, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    fl.connect(g); g.connect(duck); if (fx) g.connect(delay);
  }

  // The tune is sung by a different animal each time round: a synth voice shaped into a moo, a meow, etc.
  // f = two formant filters [hz, hz] at the start, middle and end of each note; pitch = cents at start/middle/end;
  // trem = wobble [rate hz, depth] (bleats, ribbits, quacks); oct = octave shift; atk = how soft the note starts
  const SINGERS = [
    { name: 'Cat',   emoji: '🐱', oct: 0,  type: 'sawtooth', f: [[350, 2300], [850, 1500], [420, 900]], pitch: [-150, 180, -250], vib: 25, atk: 0.03, peak: 0.42 },
    { name: 'Owl',   emoji: '🦉', oct: 0,  type: 'triangle', f: [[300, 700], [420, 850], [280, 650]], pitch: [-250, 0, -350], vib: 10, atk: 0.05, peak: 0.6, q: 5 },
    { name: 'Frog',  emoji: '🐸', oct: -1, type: 'square',   f: [[550, 1400], [650, 1500], [500, 1300]], pitch: [-100, 0, -100], trem: [13, 1], atk: 0.005, peak: 0.4 },
    { name: 'Dog',   emoji: '🐶', oct: -1, type: 'sawtooth', f: [[600, 1200], [450, 900], [300, 650]], pitch: [350, 0, -200], atk: 0.005, peak: 0.55, bark: true },
    { name: 'Cow',   emoji: '🐄', oct: -1, type: 'sawtooth', f: [[280, 650], [700, 1150], [380, 800]], pitch: [-300, 0, -150], vib: 18, atk: 0.06, peak: 0.5 },
    { name: 'Duck',  emoji: '🦆', oct: 0,  type: 'square',   f: [[1100, 2600], [900, 2100], [700, 1700]], pitch: [100, 0, -400], trem: [32, 0.6], atk: 0.005, peak: 0.36, q: 9 },
    { name: 'Sheep', emoji: '🐑', oct: 0,  type: 'sawtooth', f: [[750, 1250], [850, 1350], [700, 1200]], pitch: [-80, 0, -60], trem: [8.5, 0.75], atk: 0.02, peak: 0.45 },
  ];
  // Extra voices for drawings the test page recognises (see test.html). breath = [hz, level] of noise under the note
  const MORE = {
    bird:     { name: 'Bird',     emoji: '🐦', oct: 1,  type: 'sine',     f: null, pitch: [-600, 60, 0], trem: [17, 0.55], atk: 0.01, peak: 0.16 },
    pig:      { name: 'Pig',      emoji: '🐷', oct: 0,  type: 'square',   f: [[500, 1600], [700, 1900], [450, 1400]], pitch: [200, 0, -500], trem: [24, 0.5], atk: 0.005, peak: 0.38, q: 10 },
    horse:    { name: 'Horse',    emoji: '🐴', oct: 0,  type: 'sawtooth', f: [[900, 2200], [700, 1600], [500, 1200]], pitch: [300, 0, -500], vib: 90, atk: 0.01, peak: 0.4 },
    lion:     { name: 'Lion',     emoji: '🦁', oct: -1, type: 'sawtooth', f: [[400, 900], [650, 1100], [300, 700]], pitch: [-200, 0, -400], trem: [30, 0.35], breath: [700, 0.18], atk: 0.04, peak: 0.55 },
    mouse:    { name: 'Mouse',    emoji: '🐭', oct: 2,  type: 'triangle', f: null, pitch: [-300, 80, 200], vib: 40, atk: 0.005, peak: 0.12 },
    fish:     { name: 'Fish',     emoji: '🐟', oct: 0,  type: 'sine',     f: null, pitch: [-900, 0, 400], trem: [21, 0.9], atk: 0.005, peak: 0.3 },
    shrimp:   { name: 'Shrimp',   emoji: '🦐', oct: 1,  type: 'square',   f: [[1800, 3600], [1500, 3000], [2000, 3800]], pitch: [0, 0, 300], trem: [40, 1], atk: 0.002, peak: 0.25, q: 12 },
    bee:      { name: 'Bee',      emoji: '🐝', oct: 0,  type: 'sawtooth', f: [[600, 1800], [650, 1900], [600, 1800]], pitch: [-30, 0, -30], trem: [55, 0.5], atk: 0.02, peak: 0.3 },
    elephant: { name: 'Elephant', emoji: '🐘', oct: 0,  type: 'sawtooth', f: [[1200, 2600], [1500, 3000], [1000, 2400]], pitch: [-400, 0, -200], vib: 30, breath: [2500, 0.1], atk: 0.03, peak: 0.42, q: 9 },
    monkey:   { name: 'Monkey',   emoji: '🐵', oct: 0,  type: 'sawtooth', f: [[350, 800], [800, 1300], [350, 800]], pitch: [-200, 300, 0], trem: [6, 0.7], atk: 0.01, peak: 0.45 },
    snake:    { name: 'Snake',    emoji: '🐍', oct: 0,  type: 'sine',     f: null, pitch: [0, 0, -100], breath: [6000, 0.5], atk: 0.04, peak: 0.08 },
    person:   { name: 'Person',   emoji: '🧑', oct: 0,  type: 'sawtooth', f: [[700, 1200], [750, 1250], [400, 900]], pitch: [-60, 0, -60], vib: 20, atk: 0.02, peak: 0.42 },
    mystery:  { name: 'Mystery',  emoji: '🎤', oct: 0,  type: 'square',   f: [[600, 1500], [800, 1700], [500, 1300]], pitch: [-80, 0, -80], vib: 15, atk: 0.01, peak: 0.3 },
  };
  const VOICES = Object.assign({}, MORE, ...SINGERS.map(v => ({ [v.name.toLowerCase()]: v })));
  // A page can choose who sings each round: Music.chooser = round => voice (or null for the usual animals).
  // The pick is kept for the whole round so the banner and the voice always match.
  let chooser = null; const picks = new Map();
  function pickFor(round) {
    if (!picks.has(round)) {
      let v = null; try { v = chooser && chooser(round); } catch (e) {}
      picks.set(round, v || SINGERS[round % SINGERS.length]);
      if (picks.size > 50) picks.delete(picks.keys().next().value);
    }
    return picks.get(round);
  }
  // Each round = 2 bars of beat, then the 8-bar tune, counted from the moment the music starts,
  // so the tune comes in 2 bars after you press play and the cat always sings it first.
  const INTRO = 8, ROUND = INTRO + 32;   // in beats
  let startBeat = 0;
  const roundBeat = n => ((n - startBeat) % ROUND + ROUND) % ROUND;
  const roundOf = n => Math.floor(Math.max(0, n - startBeat) / ROUND);   // a new animal each round
  function sing(a, t, midi, dur) {
    const end = t + dur, mid = t + Math.min(0.15, dur * 0.35), f0 = hz(midi + 12 * a.oct);
    const g = ac.createGain(), amp = ac.createGain(); amp.connect(g);
    // pitch: scoop in, settle, fall off the end
    const o = ac.createOscillator(); o.type = a.type; o.frequency.value = f0;
    o.detune.setValueAtTime(a.pitch[0], t); o.detune.linearRampToValueAtTime(a.pitch[1], mid);
    o.detune.setValueAtTime(a.pitch[1], Math.max(mid, end - 0.12)); o.detune.linearRampToValueAtTime(a.pitch[2], end + 0.1);
    if (a.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = a.vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(end + 0.3); }
    if (a.f) {           // mouth shape: two resonant bandpasses gliding through the vowel
      const mix = ac.createGain(); mix.gain.value = 3.2; mix.connect(amp);
      a.f[0].forEach((fr, i) => {
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = a.q || 7;
        bp.frequency.setValueAtTime(fr, t); bp.frequency.linearRampToValueAtTime(a.f[1][i], mid);
        bp.frequency.linearRampToValueAtTime(a.f[2][i], end + 0.1);
        const bg = ac.createGain(); bg.gain.value = i ? 0.55 : 1; o.connect(bp); bp.connect(bg); bg.connect(mix);
      });
    } else o.connect(amp);
    if (a.breath) {      // hiss / roar / trunk air under the note
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), ng = ac.createGain();
      s.buffer = noise; s.loop = true; fl.type = 'bandpass'; fl.frequency.value = a.breath[0]; fl.Q.value = 1.2;
      ng.gain.value = a.breath[1] / a.peak; s.connect(fl); fl.connect(ng); ng.connect(amp); s.start(t, Math.random() * 0.5); s.stop(end + 0.2);
    }
    if (a.trem) {        // wobble: baa-a-a, rib-bit, quack rasp, bird trill
      amp.gain.value = 1 - a.trem[1] / 2;
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = a.trem[0]; lg.gain.value = a.trem[1] / 2;
      l.connect(lg); lg.connect(amp.gain); l.start(t); l.stop(end + 0.3);
    }
    if (a.bark) {        // a puff of breath on the front of each woof
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), ng = ac.createGain();
      s.buffer = noise; fl.type = 'bandpass'; fl.frequency.value = 900; fl.Q.value = 1.5;
      env(ng, t, 0.003, 0.5, 0.09); s.connect(fl); fl.connect(ng); ng.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + 0.15);
    }
    // a bark punches then sags; everyone else holds the note
    const hold = a.bark ? a.peak * 0.45 : a.peak;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a.peak, t + a.atk);
    g.gain.exponentialRampToValueAtTime(hold, t + a.atk + 0.12);
    g.gain.setValueAtTime(hold, Math.max(t + a.atk + 0.12, end - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
    g.connect(duck); g.connect(delay);
    o.start(t); o.stop(end + 0.3);
  }

  // what plays on beat n: 2 bars of groove (bass, chords, drums), then 8 bars with the tune on top, round and round
  function beat(n, t) {
    const inLoop = roundBeat(n), tb = inLoop - INTRO, withTune = tb >= 0, b = inLoop % 4;
    const bar = withTune ? Math.floor(tb / 4) % 8 : 0;                // intro sits on C
    const fill = inLoop >= INTRO - 4 && inLoop < INTRO;               // bar before the tune: snare roll
    if (!(fill && b === 3)) kick(t);
    hat(t + SPB / 2, b % 2 === 1);
    if (b === 1 || b === 3) clap(t);
    if (fill) for (let i = 0; i < 4; i++) hiss(t + i * SPB / 4, 'bandpass', 1800 + b * 400 + i * 100, 1, 0.12 + b * 0.06, 0.06);
    const root = ROOTS[bar];
    synth(t + SPB / 2, root, SPB / 2 * 0.9, { cut: 500, peak: 0.32, type: 'sawtooth' });              // offbeat bass
    synth(t + SPB / 2 + SPB / 4, root + 12, SPB / 4 * 0.9, { cut: 700, peak: 0.16, type: 'square' });
    if (b === 0 || b === 2) for (const m of CHORD[root]) synth(t + SPB / 2, m, SPB * 0.3, { cut: 2200, peak: 0.06, det: 9, fx: true });
    if (withTune) for (const x of NOTES) {
      if (x.b >= tb && x.b < tb + 1) {
        const at = t + (x.b - tb) * SPB, dur = x.d * SPB * 0.92;
        sing(pickFor(roundOf(n)), at, x.n, dur);
      }
    }
  }

  // look-ahead scheduler: beat n plays at page time n * SPB (same clock as the dancers)
  function pump() {
    const ahead = ac.currentTime + 0.25;
    while (next * SPB - offset < ahead) { const at = next * SPB - offset; if (at > ac.currentTime) beat(next, at); next++; }
  }
  function start() {
    if (!ac) setup();
    ac.resume();
    offset = performance.now() / 1000 - ac.currentTime;   // page seconds minus audio seconds
    next = Math.ceil((ac.currentTime + offset + 0.05) / SPB);
    startBeat = next; picks.clear();
    out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0.8, ac.currentTime, 0.05);
    clearInterval(timer); timer = setInterval(pump, 50); pump(); on = true;
  }
  function stop() {
    if (!ac) return; clearInterval(timer); on = false;
    out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.08);
  }
  // render the loop offline (for previews/tests): resolves an AudioBuffer
  async function render(seconds = 32) {
    setup(new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100));
    startBeat = 0; picks.clear(); for (let n = 0; n * SPB < seconds; n++) beat(n, n * SPB + 0.05);
    const buf = await ac.startRendering(); ac = null; return buf;
  }
  // who's singing right now (null while the groove plays without the tune), on the dancers' page clock
  function singer() {
    const n = Math.floor(performance.now() / 1000 / SPB);
    return on && n >= startBeat && roundBeat(n) >= INTRO ? pickFor(roundOf(n)) : null;
  }
  return { start, stop, render, singer, SINGERS, VOICES, set chooser(f) { chooser = f; picks.clear(); }, toggle() { on ? stop() : start(); return on; }, get on() { return on; } };
})();
