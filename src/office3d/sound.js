// ---- Ambient sound ----
// Small synthesised sounds, made with the Web Audio API (no audio files): a
// quiet room tone, a soft blip when someone speaks, and a few event sounds.
// Off until the visitor turns it on; the choice is remembered in this browser.
// The party's boombox and the band's set are synthesised too: two tracks
// behind startMusic(track) / stopMusic().
//
//   const sound = createSound();
//   sound.setEnabled(true);          // must follow a click (browser rule)
//   sound.play('speak', { pitch: 1.2 });

const KEY = 'offquarium.sound';
const VOLUME = 0.5;
// Beats per minute of each music track. The band's must match its art
// (ACT_LOOPS.band.bpm in standee.js) and SHOWS.band.bpm in data.js.
export const TRACK_BPM = { party: 124, band: 132 };

export function createSound() {
  let ctx = null, master = null, hum = null, bus = null;
  const music = { want: false, track: 'party', timer: 0, step: 0, next: 0, duck: 1, kicks: [], white: null, drive: null };
  let enabled = false;
  const stored = () => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } };
  const store = on => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.04) / 1.02;   // brown-ish noise
      data[i] = last * 3.2;
    }
    return buffer;
  }

  function start() {
    if (ctx) return true;
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) return false;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    bus = ctx.createGain();      // the boombox, so it can be ducked on its own
    bus.gain.value = music.duck;
    bus.connect(master);
    // Room tone: low filtered noise, looping.
    hum = ctx.createBufferSource();
    hum.buffer = noiseBuffer(4);
    hum.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const level = ctx.createGain();
    level.gain.value = 0.16;
    hum.connect(filter).connect(level).connect(master);
    hum.start();
    return true;
  }

  // One enveloped oscillator note.
  function tone(freq, { at = 0, length = 0.12, type = 'sine', gain = 0.2, slide = 0, out = master } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + length);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(amp).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  const SOUNDS = {
    speak: ({ pitch = 1 }) => tone(520 * pitch, { length: 0.09, gain: 0.07, slide: 1.25 }),
    tap: () => { tone(190, { length: 0.07, type: 'triangle', gain: 0.3, slide: 0.6 }); tone(170, { at: 0.13, length: 0.07, type: 'triangle', gain: 0.22, slide: 0.6 }); },
    jam: () => { for (let i = 0; i < 4; i++) tone(96, { at: i * 0.11, length: 0.08, type: 'square', gain: 0.07 }); },
    fixed: () => { tone(660, { length: 0.1, gain: 0.12 }); tone(880, { at: 0.1, length: 0.16, gain: 0.12 }); },
    donut: () => { tone(784, { length: 0.1, gain: 0.12 }); tone(1047, { at: 0.09, length: 0.2, gain: 0.12 }); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.08, length: 0.14, gain: 0.11 })),
    ghost: () => tone(300, { length: 0.9, gain: 0.06, slide: 1.9 }),
    flicker: () => { for (let i = 0; i < 3; i++) tone(1400, { at: i * 0.16, length: 0.03, type: 'square', gain: 0.03 }); },
    door: () => { tone(140, { length: 0.1, type: 'triangle', gain: 0.2, slide: 0.7 }); },
    cake: () => [523, 523, 587, 523, 698, 659].forEach((f, i) => tone(f, { at: i * 0.17, length: 0.15, gain: 0.1 })),
  };

  // ---- Music ----
  // Sixteen steps to the bar, scheduled a little ahead of the clock, as Web
  // Audio needs. Each track plays one step at a time (TRACKS below).
  const AHEAD_S = 0.25;
  const stepS = () => 60 / TRACK_BPM[music.track] / 4;

  // The boombox, 124 BPM: kick on the beat, clap on 2 and 4, hats between, a
  // bass line and a short minor arpeggio.
  const BASS = [55, 0, 55, 0, 82.4, 0, 55, 0, 65.4, 0, 65.4, 0, 73.4, 0, 82.4, 0];
  const ARP = [220, 261.6, 329.6, 261.6, 220, 329.6, 392, 329.6];
  function burst(at, { length = 0.05, gain = 0.1, freq = 7000, type = 'highpass' } = {}) {
    music.white ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = music.white;
    filter.type = type;
    filter.frequency.value = freq;
    amp.gain.setValueAtTime(gain, at);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(filter).connect(amp).connect(bus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + length + 0.02);
  }
  function playPartyStep(step, at) {
    const lag = at - ctx.currentTime, STEP_S = stepS();
    if (step % 4 === 0) {
      tone(150, { at: lag, length: 0.22, gain: 0.55, slide: 0.28, out: bus });
      music.kicks.push(at);
    }
    if (step % 8 === 4) burst(at, { length: 0.13, gain: 0.22, freq: 1500 });
    if (step % 2 === 0 && step % 4 !== 0) burst(at, { length: 0.04, gain: 0.12 });
    else if (step % 2 === 1) burst(at, { length: 0.02, gain: 0.04 });
    if (BASS[step]) tone(BASS[step], { at: lag, length: STEP_S * 1.7, type: 'sawtooth', gain: 0.17, out: bus });
    if (step % 2 === 0) tone(ARP[(step / 2) % ARP.length], { at: lag, length: STEP_S * 1.4, type: 'square', gain: 0.035, out: bus });
  }

  // The garage band, 132 BPM: a rock beat (kick on 1 and 3 with a push before
  // 3, snare on 2 and 4, eighth-note hats) under a distorted sawtooth
  // power-chord riff, E5 G5 A5 D5, one chord a bar over four bars.
  const RIFF_ROOTS = [82.41, 98.0, 110.0, 73.42];
  const RIFF_HITS = [0, 2, 3, 6, 8, 10, 11, 14];
  // The amp: a soft clipper and a cabinet-like low-pass, made once.
  function drive() {
    if (music.drive) return music.drive;
    const shaper = ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * 6); }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const cab = ctx.createBiquadFilter(), level = ctx.createGain();
    cab.type = 'lowpass';
    cab.frequency.value = 2600;
    level.gain.value = 0.12;
    shaper.connect(cab).connect(level).connect(bus);
    return (music.drive = shaper);
  }
  function playBandStep(step, at, bar) {
    const lag = at - ctx.currentTime, STEP_S = stepS();
    if (step === 0 || step === 8 || step === 10) {
      tone(140, { at: lag, length: 0.2, gain: 0.55, slide: 0.3, out: bus });
      music.kicks.push(at);
    }
    if (step === 4 || step === 12) {
      burst(at, { length: 0.16, gain: 0.26, freq: 1800, type: 'bandpass' });
      tone(200, { at: lag, length: 0.08, type: 'triangle', gain: 0.14, slide: 0.7, out: bus });
    }
    if (step % 2 === 0) burst(at, { length: step % 4 === 2 ? 0.05 : 0.03, gain: 0.08 });
    if (RIFF_HITS.includes(step)) {
      const root = RIFF_ROOTS[bar % RIFF_ROOTS.length];
      const long = step === 0 || step === 8;
      for (const f of [root, root * 1.5, root * 2]) {
        tone(f, { at: lag, length: STEP_S * (long ? 1.8 : 0.9), type: 'sawtooth', gain: 0.09, out: drive() });
      }
    }
  }

  const TRACKS = { party: playPartyStep, band: playBandStep };

  function pump() {
    if (!music.want || !enabled || !ctx || ctx.state !== 'running') { music.next = 0; return; }
    if (!music.next || music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
    const play = TRACKS[music.track], STEP_S = stepS();
    while (music.next < ctx.currentTime + AHEAD_S) {
      play(music.step % 16, music.next, Math.floor(music.step / 16));
      music.step++;
      music.next += STEP_S;
    }
    music.kicks = music.kicks.filter(t => t > ctx.currentTime - 1);
  }

  return {
    get enabled() { return enabled; },
    // The boombox ('party') or the band ('band'). Wanted music starts as soon
    // as sound is on, and stops when it is off. Starting another track while
    // one plays switches over on the next step; there is only ever one timer.
    startMusic(track = 'party') {
      if (!Object.hasOwn(TRACKS, track)) track = 'party';
      if (music.track !== track) music.kicks = [];
      music.track = track;
      music.want = true;
      music.step = 0;
      if (!music.timer) music.timer = setInterval(pump, 80);
      pump();
    },
    stopMusic() {
      music.want = false;
      music.kicks = [];
      clearInterval(music.timer);
      music.timer = 0;
    },
    get musicWanted() { return music.want; },
    // Beats per minute of the track that plays (or last played).
    get bpm() { return TRACK_BPM[music.track]; },
    // 0.3 (quiet, someone is talking) .. 1.
    duck(level) {
      music.duck = level;
      bus?.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
    },
    // How hard the last kick drum hit, 1 right on it, fading to 0 within a beat.
    beat() {
      if (!ctx || !music.want || !music.kicks.length) return 0;
      const past = ctx.currentTime - Math.max(...music.kicks.filter(t => t <= ctx.currentTime), -Infinity);
      return Number.isFinite(past) ? Math.exp(-past * 7) * music.duck : 0;
    },
    // True if the visitor had sound on last time (it still needs a click to start).
    wasOn: stored,
    setEnabled(on) {
      if (on && !start()) return false;
      enabled = on;
      store(on);
      if (ctx) {
        if (on) ctx.resume();
        master.gain.setTargetAtTime(on ? VOLUME : 0, ctx.currentTime, 0.08);
      }
      return enabled;
    },
    play(name, options = {}) {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      SOUNDS[name]?.(options);
    },
  };
}
