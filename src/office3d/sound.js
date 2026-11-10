// ---- Ambient sound ----
// Small synthesised sounds, made with the Web Audio API (no audio files): a
// quiet room tone, a soft blip when someone speaks, and a few event sounds.
// Off until the visitor turns it on; the choice is remembered in this browser.
//
//   const sound = createSound();
//   sound.setEnabled(true);          // must follow a click (browser rule)
//   sound.play('speak', { pitch: 1.2 });

const KEY = 'offquarium.sound';
const VOLUME = 0.5;

export function createSound() {
  let ctx = null, master = null, hum = null;
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
  function tone(freq, { at = 0, length = 0.12, type = 'sine', gain = 0.2, slide = 0 } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + length);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(amp).connect(master);
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

  return {
    get enabled() { return enabled; },
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
