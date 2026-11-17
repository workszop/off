// ---- Ambient sound ----
// Small synthesised sounds, made with the Web Audio API (no audio files): a
// quiet room tone, a soft blip when someone speaks, and a few event sounds.
// Off until the visitor turns it on; the choice is remembered in this browser.
// The party's boombox is a synthesised beat too (startMusic / stopMusic).
//
//   const sound = createSound();
//   sound.setEnabled(true);          // must follow a click (browser rule)
//   sound.play('speak', { pitch: 1.2 });

const KEY = 'offquarium.sound';
const VOLUME = 0.5;

export function createSound() {
  let ctx = null, master = null, hum = null, bus = null;
  const music = { want: false, timer: 0, step: 0, next: 0, duck: 1, kicks: [], white: null };
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

  // ---- Boombox ----
  // 124 BPM, sixteen steps to the bar: kick on the beat, clap on 2 and 4, hats
  // between, a bass line and a short minor arpeggio. Scheduled a little ahead of
  // the clock, as Web Audio needs.
  const BPM = 124, STEP_S = 60 / BPM / 4, AHEAD_S = 0.25;
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
  function playStep(step, at) {
    const lag = at - ctx.currentTime;
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
  function pump() {
    if (!music.want || !enabled || !ctx || ctx.state !== 'running') { music.next = 0; return; }
    if (!music.next || music.next < ctx.currentTime) music.next = ctx.currentTime + 0.05;
    while (music.next < ctx.currentTime + AHEAD_S) {
      playStep(music.step % 16, music.next);
      music.step++;
      music.next += STEP_S;
    }
    music.kicks = music.kicks.filter(t => t > ctx.currentTime - 1);
  }

  return {
    get enabled() { return enabled; },
    // The boombox. Wanted music starts as soon as sound is on, and stops when it is off.
    startMusic() {
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
