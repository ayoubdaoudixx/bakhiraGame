// Audio system stub. Lazy-creates an AudioContext on first user gesture.
// Real sounds plug in via Audio.register(name, url) once /assets/audio/ is populated.

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.buffers = new Map();
    this._bound = false;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  bindUnlock() {
    if (this._bound) return;
    this._bound = true;
    const unlock = () => {
      this._ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  async register(name, url) {
    try {
      this._ensure();
      if (!this.ctx) return;
      const res = await fetch(url);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers.set(name, buf);
    } catch { /* graceful: no-op */ }
  }

  play(name, { volume = 1, rate = 1 } = {}) {
    if (this.muted) return;
    this._ensure();
    if (!this.ctx) return;
    // stop any currently playing audio
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch { /* already stopped */ }
    }
    const buf = this.buffers.get(name);
    if (!buf) { this._beep(name); return; }
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(g).connect(this.master);
    this.currentSource = src;
    src.start();
  }

  // Simple synthesized beep so the audio API is exercised even before real sfx land.
  _beep(name) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const tones = { jump: 660, hit: 220, pickup: 880, hurt: 140, shoot: 520, boom: 90, victory: 440 };
    osc.frequency.value = tones[name] || 440;
    osc.type = name === 'boom' ? 'sawtooth' : 'square';
    g.gain.value = 0.001;
    g.gain.setValueAtTime(0.001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  setMuted(m) { this.muted = m; }
}

export const Audio = new AudioSystem();
