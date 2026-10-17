// Forest disco soundtrack: a little dance remix of Happy Birthday (the tune is public domain),
// synthesised live with Web Audio and locked to the same 120 BPM beat the dancers hop to.
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

  // what plays on beat n: 16-bar loop = 8 bars groove (bass, chords, drums), then 8 bars with the tune on top
  function beat(n, t) {
    const inLoop = n % 64, bar = Math.floor(inLoop / 4) % 8, b = inLoop % 4, withTune = inLoop >= 32;
    const fill = inLoop % 32 >= 28;                                   // last bar before each half: snare roll
    if (!(fill && b === 3)) kick(t);
    hat(t + SPB / 2, b % 2 === 1);
    if (b === 1 || b === 3) clap(t);
    if (fill) for (let i = 0; i < 4; i++) hiss(t + i * SPB / 4, 'bandpass', 1800 + b * 400 + i * 100, 1, 0.12 + b * 0.06, 0.06);
    const root = ROOTS[bar];
    synth(t + SPB / 2, root, SPB / 2 * 0.9, { cut: 500, peak: 0.32, type: 'sawtooth' });              // offbeat bass
    synth(t + SPB / 2 + SPB / 4, root + 12, SPB / 4 * 0.9, { cut: 700, peak: 0.16, type: 'square' });
    if (b === 0 || b === 2) for (const m of CHORD[root]) synth(t + SPB / 2, m, SPB * 0.3, { cut: 2200, peak: 0.06, det: 9, fx: true });
    if (withTune) for (const x of NOTES) {
      if (x.b >= inLoop - 32 && x.b < inLoop - 32 + 1) {
        const at = t + (x.b - (inLoop - 32)) * SPB, dur = x.d * SPB * 0.92;
        synth(at, x.n, dur, { type: 'square', cut: 3200, peak: 0.13, det: 6, fx: true, vib: 12 });
        synth(at, x.n + 12, dur, { type: 'triangle', cut: 5000, peak: 0.05 });
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
    for (let n = 0; n * SPB < seconds; n++) beat(n, n * SPB + 0.05);
    const buf = await ac.startRendering(); ac = null; return buf;
  }
  return { start, stop, render, toggle() { on ? stop() : start(); return on; }, get on() { return on; } };
})();
