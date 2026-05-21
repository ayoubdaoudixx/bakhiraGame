// Audio system.
// Two channels:
//   - `play(name)`        : one-shot SFX/music. Cancels its own previous source
//                           so e.g. background music can be replaced.
//   - `playSequential(name)`: narrative VOICE channel. Each queued clip waits
//                           for the previous one to finish before starting,
//                           so intro/defeat/between voices never overlap.

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.buffers = new Map();
    this._bound = false;
    // Sequential voice channel state
    this._voiceQueue = [];
    this._voicePlaying = false;
    this._voiceSrc = null;
    this._readyWaiters = new Map();   // name → array of resolvers waiting for load
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    // Whenever the browser flips the AudioContext to 'running' (after a user
    // gesture / a system unsuspend), drain any voice that was queued while it
    // was suspended. Without this hook, a clip queued during the user's START
    // click would silently sit in the queue forever.
    if (typeof this.ctx.addEventListener === 'function') {
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx.state === 'running' && this._voiceQueue.length && !this._voicePlaying) {
          this._drainVoiceQueue();
        }
      });
    }
  }

  bindUnlock() {
    if (this._bound) return;
    this._bound = true;
    const unlock = () => {
      this._ensure();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      // Once the user has interacted, drain any pending voice queue.
      if (this._voiceQueue.length && !this._voicePlaying) this._drainVoiceQueue();
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
      // Anyone awaiting this clip can now proceed.
      const waiters = this._readyWaiters.get(name);
      if (waiters) {
        for (const w of waiters) w();
        this._readyWaiters.delete(name);
      }
    } catch { /* graceful: no-op */ }
  }

  // One-shot SFX channel — intentionally muted for the current iteration.
  // The user wants ONLY the three narrative lines (game-start, enemy1-intro,
  // enemy1-defeat) audible right now; SFX like jump/hit/pickup must stay silent.
  // Re-enable by restoring the body if a later step wants SFX back.
  play(/* name, opts */) { /* silenced */ }

  // ── Sequential voice channel ──────────────────────────────────────────
  // Each call APPENDS to a queue. Items play one at a time; the next one
  // doesn't start until the previous one has emitted `onended`. This is
  // the channel used for stage-start, enemy intros/defeats, between-enemies,
  // and boss intro/defeat narration.
  playSequential(name, opts = {}) {
    if (this.muted) return;
    this._voiceQueue.push({ name, opts });
    if (!this._voicePlaying) this._drainVoiceQueue();
  }

  // Wipe everything pending and stop the currently-playing voice. Useful on
  // a full level restart so old narration doesn't bleed into the new attempt.
  clearVoiceQueue() {
    this._voiceQueue.length = 0;
    if (this._voiceSrc) {
      try { this._voiceSrc.onended = null; } catch {}
      try { this._voiceSrc.stop(); } catch {}
      this._voiceSrc = null;
    }
    this._voicePlaying = false;
  }

  async _drainVoiceQueue() {
    if (this._voiceQueue.length === 0) {
      this._voicePlaying = false;
      this._voiceSrc = null;
      return;
    }
    this._voicePlaying = true;
    const { name, opts } = this._voiceQueue.shift();
    this._ensure();
    if (!this.ctx) { this._voicePlaying = false; return; }

    // Actively try to resume the AudioContext. Browsers create it in
    // 'suspended' state until a user gesture; calling resume() *inside* the
    // gesture (e.g. the START click) is enough to flip it to 'running'.
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }
    if (this.ctx.state !== 'running') {
      // Couldn't unlock yet — put the clip back at the front of the queue.
      // The `statechange` listener installed in _ensure() will re-drain as
      // soon as the context becomes 'running'.
      this._voiceQueue.unshift({ name, opts });
      this._voicePlaying = false;
      return;
    }

    // Wait briefly for the clip to finish decoding if it's still in flight.
    let buf = this.buffers.get(name);
    if (!buf) {
      await new Promise(resolve => {
        const waiters = this._readyWaiters.get(name) || [];
        waiters.push(resolve);
        this._readyWaiters.set(name, waiters);
        setTimeout(resolve, 3000);   // 3s hard cap
      });
      buf = this.buffers.get(name);
    }
    if (!buf) {
      // Still no buffer — skip this item and move on.
      this._drainVoiceQueue();
      return;
    }

    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    src.connect(g).connect(this.master);
    src.onended = () => {
      if (this._voiceSrc === src) this._voiceSrc = null;
      this._drainVoiceQueue();
    };
    this._voiceSrc = src;
    src.start();
  }

  isVoiceBusy() { return this._voicePlaying || this._voiceQueue.length > 0; }

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

  setMuted(m) {
    this.muted = m;
    if (m) this.clearVoiceQueue();
  }
}

export const Audio = new AudioSystem();
