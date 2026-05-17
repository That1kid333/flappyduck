// audio.js — Synthesized sound effects via Web Audio API (no asset files needed)
let _ctx = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume on iOS (requires user gesture to unlock)
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

let _enabled = localStorage.getItem('flappyDuckSound') !== 'false';

export function isSoundEnabled() { return _enabled; }

export function setSoundEnabled(val) {
  _enabled = val;
  localStorage.setItem('flappyDuckSound', val ? 'true' : 'false');
}

function tone({ freq = 440, endFreq = null, type = 'sine', dur = 0.15, vol = 0.25, delay = 0 }) {
  if (!_enabled) return;
  try {
    const c = getCtx();
    const t = c.currentTime + delay;
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch { /* audio unavailable */ }
}

// Flap — quick ascending chirp
export function playFlap() {
  tone({ freq: 480, endFreq: 680, type: 'triangle', dur: 0.07, vol: 0.18 });
}

// Score point — bright ping
export function playScore() {
  tone({ freq: 880, endFreq: 1320, type: 'sine', dur: 0.09, vol: 0.14 });
}

// Death — descending crunch
export function playDeath() {
  tone({ freq: 280, endFreq: 70,  type: 'sawtooth', dur: 0.5,  vol: 0.28 });
  tone({ freq: 140, endFreq: 50,  type: 'square',   dur: 0.35, vol: 0.12, delay: 0.1 });
}

// Achievement unlocked — ascending 3-note fanfare
export function playAchievement() {
  tone({ freq: 660,  type: 'sine', dur: 0.15, vol: 0.22 });
  tone({ freq: 880,  type: 'sine', dur: 0.18, vol: 0.22, delay: 0.13 });
  tone({ freq: 1320, type: 'sine', dur: 0.28, vol: 0.20, delay: 0.28 });
}

// UI click — subtle tick
export function playClick() {
  tone({ freq: 600, endFreq: 800, type: 'sine', dur: 0.05, vol: 0.10 });
}
