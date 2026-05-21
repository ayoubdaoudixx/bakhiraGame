// Cutscene system. Both intro and victory scenes are scripted timelines
// of "beats" that drive what's drawn each frame. Pure canvas — no DOM video.

import { Assets } from '../core/assets.js';
import { Particles } from '../engine/particles.js';

const ACT_INTRO = [
  // Act 1: Stadium roar — our hero celebrates a goal under spotlights
  { t: 0,    end: 4.0,  scene: 'stadium',
    text: { line: 'STADIUM. NIGHT.', sub: 'The roar still echoes…' } },
  { t: 4.0,  end: 8.0,  scene: 'celebrate',
    text: { line: 'A HERO IS BORN', sub: 'One man, ninety minutes, a city on its feet.' } },
  // Act 2: a shadow appears
  { t: 8.0,  end: 12.0, scene: 'shadowEnter',
    text: { line: 'SOMETHING WATCHES.', sub: 'The lights begin to flicker.' } },
  // Act 3: dark magic drains the gift
  { t: 12.0, end: 18.0, scene: 'drain',
    text: { line: 'THE GIFT IS STOLEN.', sub: 'Years of glory… ripped from his bones.' } },
  // Act 4: villain CAGES the girlfriend, then they vanish in dark smoke
  { t: 18.0, end: 25.5, scene: 'kidnap',
    text: { line: 'AND SHE IS CAGED.', sub: 'Iron bars. Black smoke. Gone.' } },
  // Act 5: rise — determined
  { t: 25.5, end: 31.0, scene: 'rise',
    text: { line: 'ENOUGH.', sub: 'It is time to take it all back.' } },
];

const ACT_VICTORY = [
  { t: 0, end: 3.5, scene: 'bossFall', text: { line: 'THE HOOLIGAN FALLS.', sub: 'One enforcer down. The shadow still smiles.' } },
  { t: 3.5, end: 7.5, scene: 'reunion', text: { line: 'SHE IS NOT HERE.', sub: 'The villain runs deeper. The next stadium is already waiting.' } },
];

export class Cutscene {
  constructor(canvas, kind = 'intro', audio, onDone) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.kind = kind;
    this.audio = audio;
    this.onDone = onDone;
    this.t = 0;
    this.skipped = false;
    this.particles = new Particles();
    this.beats = kind === 'intro' ? ACT_INTRO : ACT_VICTORY;
    this.duration = this.beats[this.beats.length - 1].end;
    this.skipBtn = { x: this.W - 130, y: 24, w: 110, h: 36 };
    this.replayBtn = null;
    this.done = false;
    this.lightT = 0;
    this.audioTriggered = {};

    // Asset preloads — hero.png is the protagonist sprite for cutscenes too.
    Assets.loadImage('mainChar',   '/assets/hero.png',                      'HERO');
    Assets.loadImage('villain',    '/assets/characters/villain.jpeg',       'VILLAIN');
    Assets.loadImage('girlfriend', '/assets/characters/girlfriend.png',     'GF');
    Assets.loadImage('bgLvl1',     '/assets/castle-bg.png',                 'BG');

    // pointer for skip
    this._mouseHandler = (e) => this._handlePointer(e);
    canvas.addEventListener('pointerdown', this._mouseHandler);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._mouseHandler);
  }

  _handlePointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    if (sx >= this.skipBtn.x && sx <= this.skipBtn.x + this.skipBtn.w &&
        sy >= this.skipBtn.y && sy <= this.skipBtn.y + this.skipBtn.h) {
      this.skipped = true;
    }
  }

  update(dt, input) {
    if (this.done) return;
    this.t += dt;
    this.lightT += dt;
    this.particles.update(dt);
    // play tense music at start of intro cutscene (once)
    if (this.kind === 'intro' && this.t < 0.1 && !this.audioTriggered['tenseMusic']) {
      this.audioTriggered['tenseMusic'] = true;
      if (this.audio) this.audio.play('tense_music', { volume: 0.3 });
    }
    if (input && input.pressed('skip')) this.skipped = true;
    if (this.skipped || this.t >= this.duration) {
      this.done = true;
      if (this.onDone) this.onDone();
    }
  }

  _activeBeat() {
    for (const b of this.beats) if (this.t >= b.t && this.t < b.end) return b;
    return this.beats[this.beats.length - 1];
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);

    const beat = this._activeBeat();
    const bt = (this.t - beat.t) / (beat.end - beat.t);

    // audio triggers for key scenes
    if (beat.scene === 'celebrate' && !this.audioTriggered['celebrate']) {
      this.audioTriggered['celebrate'] = true;
      if (this.audio) this.audio.play('rwina');
    }
    if ((beat.scene === 'drain' || beat.scene === 'shadowEnter') && !this.audioTriggered['drain']) {
      this.audioTriggered['drain'] = true;
      if (this.audio) this.audio.play('chno_tra_ya_wlad_lqhab');
    }
    if (beat.scene === 'kidnap' && !this.audioTriggered['kidnap']) {
      this.audioTriggered['kidnap'] = true;
      if (this.audio) this.audio.play('chno_tra_ya_wlad_lqhab');
    }
    if (beat.scene === 'rise' && !this.audioTriggered['rise']) {
      this.audioTriggered['rise'] = true;
      if (this.audio) this.audio.play('bani_kalboun_layn3l_zaml_bok');
    }
    if (beat.scene === 'shadowEnter' && !this.audioTriggered['shadowEnter']) {
      this.audioTriggered['shadowEnter'] = true;
      if (this.audio) this.audio.play('lhajwi');
    }

    // background ambience
    this._drawBackground(beat.scene, bt);

    switch (beat.scene) {
      case 'stadium': this._stadium(bt); break;
      case 'celebrate': this._celebrate(bt); break;
      case 'shadowEnter': this._shadowEnter(bt); break;
      case 'drain': this._drain(bt); break;
      case 'kidnap': this._kidnap(bt); break;
      case 'rise': this._rise(bt); break;
      case 'bossFall': this._bossFall(bt); break;
      case 'reunion': this._reunion(bt); break;
    }

    this.particles.draw(ctx);

    this._drawText(beat, bt);
    this._drawLetterbox();
    this._drawSkipBtn();
    this._drawProgress();
  }

  // Single unified background pipeline: stadium photo for arena scenes,
  // procedural rich scenes for the "off-pitch" beats. Never empty.
  _drawBackground(scene, bt) {
    const ctx = this.ctx, W = this.W, H = this.H;

    const usePhoto = (scene === 'stadium' || scene === 'celebrate' ||
                      scene === 'shadowEnter' || scene === 'drain' ||
                      scene === 'bossFall');

    if (usePhoto) {
      const bg = Assets.get('bgLvl1');
      const isReal = Assets.isReal('bgLvl1');
      if (isReal) {
        const aspectImg = bg.width / bg.height;
        const aspectView = W / H;
        let dw, dh;
        if (aspectImg > aspectView) { dh = H * 1.10; dw = dh * aspectImg; }
        else { dw = W * 1.10; dh = dw / aspectImg; }
        // gentle slow drift for cinematic motion
        const off = Math.sin(this.t * 0.25) * 30;
        ctx.drawImage(bg, (W - dw) / 2 + off, (H - dh) / 2 - 20, dw, dh);
      } else {
        // fallback procedural stadium
        this._drawProceduralStadium();
      }

      // mood overlay grows as the scenes get darker
      const darken = scene === 'stadium' ? 0.30 :
                     scene === 'celebrate' ? 0.25 :
                     scene === 'shadowEnter' ? 0.55 :
                     scene === 'drain' ? 0.70 :
                     scene === 'bossFall' ? 0.40 : 0.30;
      ctx.fillStyle = `rgba(6,10,28,${darken})`;
      ctx.fillRect(0, 0, W, H);
      // top spotlight haze
      const top = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      top.addColorStop(0, 'rgba(255,225,180,0.16)');
      top.addColorStop(1, 'rgba(255,225,180,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, W, H * 0.5);
      // shadow-enter flicker
      if (scene === 'shadowEnter' && Math.sin(this.lightT * 18) > 0.6) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
      }
      // drain's red wash
      if (scene === 'drain') {
        const r = ctx.createRadialGradient(W*0.5, H*0.7, 50, W*0.5, H*0.7, W*0.7);
        r.addColorStop(0, 'rgba(255,42,85,0.2)');
        r.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, W, H);
      }
    } else if (scene === 'kidnap') {
      this._drawAlleyBackdrop(bt);
    } else if (scene === 'rise') {
      this._drawRainStreet();
    } else if (scene === 'reunion') {
      this._drawDawnStadium();
    } else {
      // generic dark backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0414');
      grad.addColorStop(1, '#02030a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Bottom horizon shadow so foreground silhouettes land cleanly
    const bottom = ctx.createLinearGradient(0, H * 0.55, 0, H);
    bottom.addColorStop(0, 'rgba(2,3,10,0)');
    bottom.addColorStop(1, 'rgba(2,3,10,0.85)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
  }

  _drawProceduralStadium() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // sky
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0414');
    grad.addColorStop(0.5, '#1a0a2c');
    grad.addColorStop(1, '#04060b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // stadium silhouette
    ctx.fillStyle = '#070a14';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.85);
    ctx.quadraticCurveTo(W * 0.3, H * 0.55, W * 0.5, H * 0.55);
    ctx.quadraticCurveTo(W * 0.7, H * 0.55, W, H * 0.85);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // crowd dots
    ctx.fillStyle = '#1a2138';
    for (let i = 0; i < 200; i++) {
      const x = (i * 41) % W;
      const t = i / 200;
      const y = H * (0.62 + Math.sin(t * Math.PI) * -0.06);
      ctx.fillRect(x, y, 2, 2);
    }
    // pitch
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, H * 0.85, W, H * 0.15);
    ctx.strokeStyle = 'rgba(232,238,247,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W/2, H * 0.85); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.beginPath(); ctx.arc(W/2, H * 0.92, 60, 0, Math.PI*2); ctx.stroke();
  }

  // Dark alley with brick wall + flickering single bulb. Used for the cage scene.
  _drawAlleyBackdrop(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    // base
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0613');
    grad.addColorStop(0.6, '#08060f');
    grad.addColorStop(1, '#02030a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // far brick wall
    ctx.fillStyle = '#120a16';
    ctx.fillRect(0, 0, W, H * 0.78);
    // brick rows
    ctx.fillStyle = '#1a0e1c';
    const brickH = 18, brickW = 64;
    for (let r = 0; r < Math.floor(H * 0.78 / brickH); r++) {
      const yy = r * brickH;
      const off = (r % 2) ? brickW / 2 : 0;
      for (let c = -1; c < W / brickW + 1; c++) {
        ctx.fillRect(c * brickW + off + 1, yy + 1, brickW - 2, brickH - 2);
      }
    }
    // grime streaks
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 14; i++) {
      const x = (i * 137) % W;
      ctx.fillRect(x, 0, 14, H * 0.78 * (0.4 + (i % 3) * 0.2));
    }

    // flickering bulb in upper area
    const bulbX = W * 0.62, bulbY = H * 0.18;
    const flicker = Math.sin(this.lightT * 22) > -0.4 ? 1 : 0.25;
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(bulbX - 2, 0, 4, 30);
    ctx.fillStyle = `rgba(255,225,160,${flicker})`;
    ctx.beginPath(); ctx.arc(bulbX, bulbY, 7, 0, Math.PI*2); ctx.fill();
    const halo = ctx.createRadialGradient(bulbX, bulbY, 2, bulbX, bulbY, 280);
    halo.addColorStop(0, `rgba(255,225,160,${0.25 * flicker})`);
    halo.addColorStop(1, 'rgba(255,225,160,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    // cone of light spilling toward floor
    ctx.save();
    ctx.fillStyle = `rgba(255,225,160,${0.10 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(bulbX - 6, bulbY);
    ctx.lineTo(bulbX + 6, bulbY);
    ctx.lineTo(bulbX + 240, H);
    ctx.lineTo(bulbX - 240, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // wet alley floor
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    // floor reflection of bulb
    const refl = ctx.createRadialGradient(bulbX, H * 0.95, 0, bulbX, H * 0.95, 220);
    refl.addColorStop(0, `rgba(255,225,160,${0.20 * flicker})`);
    refl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
  }

  _drawRainStreet() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a14');
    grad.addColorStop(1, '#260a14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0a0410';
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
    ctx.strokeStyle = 'rgba(232,238,247,0.18)';
    for (let i = 0; i < 80; i++) {
      const x = (i * 53 + (this.t * 600) % W);
      const y = (i * 31) % (H * 0.7);
      ctx.beginPath();
      ctx.moveTo(x % W, y); ctx.lineTo((x % W) - 3, y + 14);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(W/2, H, 50, W/2, H, W/2);
    glow.addColorStop(0, 'rgba(255,80,40,0.45)');
    glow.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  _drawDawnStadium() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const bg = Assets.get('bgLvl1');
    if (Assets.isReal('bgLvl1')) {
      const aspectImg = bg.width / bg.height;
      const aspectView = W / H;
      let dw, dh;
      if (aspectImg > aspectView) { dh = H * 1.10; dw = dh * aspectImg; }
      else { dw = W * 1.10; dh = dw / aspectImg; }
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2 - 20, dw, dh);
    }
    // dawn warm wash
    ctx.fillStyle = 'rgba(60,30,40,0.55)';
    ctx.fillRect(0, 0, W, H);
    const dawn = ctx.createLinearGradient(0, 0, 0, H);
    dawn.addColorStop(0, 'rgba(120,30,50,0.4)');
    dawn.addColorStop(0.6, 'rgba(180,80,80,0.3)');
    dawn.addColorStop(1, 'rgba(60,20,30,0)');
    ctx.fillStyle = dawn;
    ctx.fillRect(0, 0, W, H);
  }

  // -- Scenes --

  _stadium(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (Math.random() < 0.3) {
      this.particles.spawn({
        x: Math.random() * W, y: -10,
        vx: (Math.random() - .5) * 40, vy: 60 + Math.random() * 60,
        life: 4, max: 4, size: 4, color: ['#ff2a55','#ffcc33','#22e1ff','#ffffff'][(Math.random()*4)|0],
        gravity: 30, shape: 'square', rot: Math.random() * Math.PI, vrot: (Math.random()-.5)*4,
      });
    }
    drawHero(ctx, W * 0.5, H * 0.92, 1.0, 0.4 + bt * 0.6, 'cheer');
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = `rgba(255,42,85,${0.4 + 0.4 * Math.sin(this.lightT * 10)})`;
    ctx.textAlign = 'center';
    ctx.fillText('. . . FULL TIME . . .', W / 2, H * 0.10);
  }

  _celebrate(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    drawHero(ctx, W * 0.5 - 130, H * 0.92, 1.0, 0.95, 'cheer');
    drawGirlfriend(ctx, W * 0.5 + 130, H * 0.92, 1.0, Math.min(1, bt * 1.4));
    if (bt < 0.2) {
      this.particles.burst(W*0.5, H*0.7, {
        count: 30, speed: 320, life: 1.2,
        colors: ['#ff2a55','#ff7aaa','#22e1ff','#ffffff'],
        gravity: 240, size: 4, shape: 'square',
      });
    }
    if (bt > 0.25) {
      // multiple floating hearts between the couple
      const heartDefs = [
        { x: W * 0.5 - 100, y: H * 0.52, sz: 30, ph: 0.0 },
        { x: W * 0.5,        y: H * 0.44, sz: 54, ph: 1.1 },
        { x: W * 0.5 + 100,  y: H * 0.52, sz: 28, ph: 2.2 },
        { x: W * 0.5 - 55,   y: H * 0.58, sz: 20, ph: 0.7 },
        { x: W * 0.5 + 58,   y: H * 0.57, sz: 22, ph: 1.6 },
      ];
      for (const hd of heartDefs) {
        const bob = Math.sin(this.lightT * 2.4 + hd.ph) * 10;
        const a = (0.4 + 0.5 * Math.sin(this.lightT * 3 + hd.ph)) * Math.min(1, (bt - 0.25) * 3);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ff2a55';
        ctx.font = `bold ${hd.sz}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♥', hd.x, hd.y + bob);
        ctx.restore();
      }
      // rising pink heart particles
      if (Math.random() < 0.45) {
        this.particles.spawn({
          x: W * 0.5 + (Math.random() - 0.5) * 280,
          y: H * 0.74,
          vx: (Math.random() - 0.5) * 28,
          vy: -65 - Math.random() * 55,
          life: 2.4, max: 2.4, size: 5 + Math.random() * 7,
          color: ['#ff2a55', '#ff7aaa', '#ff4477'][(Math.random() * 3) | 0],
          gravity: -18, shape: 'circle', rot: 0, vrot: 0,
        });
      }
    }
    // kiss × marks near the characters
    if (bt > 0.45) {
      const kissA = Math.min(1, (bt - 0.45) * 3.5);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px serif';
      const kBob1 = Math.sin(this.lightT * 5) * 4;
      const kBob2 = Math.sin(this.lightT * 5 + 2.1) * 4;
      ctx.globalAlpha = kissA * (0.65 + 0.35 * Math.sin(this.lightT * 7));
      ctx.fillStyle = '#ff9ec0';
      ctx.fillText('×', W * 0.5 - 58, H * 0.55 + kBob1);
      ctx.globalAlpha = kissA * (0.65 + 0.35 * Math.sin(this.lightT * 7 + 1.5));
      ctx.fillText('×', W * 0.5 + 62, H * 0.53 + kBob2);
      ctx.restore();
    }
  }

  _shadowEnter(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    drawHero(ctx, W * 0.36, H * 0.92, 1.0, 1.0, 'idle');
    drawGirlfriend(ctx, W * 0.48, H * 0.92, 1.0, 1.0);
    const vx = W * (1.05 - 0.25 * bt);
    drawVillain(ctx, vx, H * 0.92, 1.05, Math.min(1, bt * 2));
    if (Math.random() < 0.7) {
      this.particles.spawn({
        x: vx + (Math.random()-.5)*60, y: H * 0.92 - Math.random() * 100,
        vx: (Math.random()-.5)*30, vy: -30 - Math.random()*30,
        life: 1.6, max: 1.6, size: 22 + Math.random()*16,
        color: 'rgba(120,30,90,0.55)', gravity: -20, shape: 'circle', rot: 0, vrot: 0,
      });
    }
  }

  _drain(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const heroX = W * 0.36, gfX = W * 0.48, villX = W * 0.78;
    drawHero(ctx, heroX, H * 0.92, 1.0, 1.0, bt > 0.3 ? 'kneel' : 'idle');
    drawGirlfriend(ctx, gfX, H * 0.92, 1.0, 1.0, 'shock');
    drawVillain(ctx, villX, H * 0.92, 1.05, 1.0, 'cast');
    const startX = heroX + 6, startY = H * 0.92 - 140;
    const endX = villX - 80, endY = H * 0.92 - 130;
    drawEnergyStream(ctx, startX, startY, endX, endY, this.lightT, bt);
    const orbR = 8 + bt * 24;
    ctx.save();
    ctx.translate(endX, endY);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, orbR * 1.6);
    grad.addColorStop(0, '#ffcc33');
    grad.addColorStop(0.5, 'rgba(255,42,85,0.6)');
    grad.addColorStop(1, 'rgba(255,42,85,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-50, -50, 100, 100);
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath(); ctx.arc(0, 0, orbR * 0.5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.9) {
      const px = startX + (Math.random()-.5) * 60;
      const py = startY + (Math.random()-.5) * 60;
      const dx = endX - px, dy = endY - py;
      const len = Math.hypot(dx, dy) || 1;
      this.particles.spawn({
        x: px, y: py, vx: dx/len * 220, vy: dy/len * 220,
        life: 0.8, max: 0.8, size: 3,
        color: ['#ffcc33','#ff2a55','#ffffff'][(Math.random()*3)|0],
        gravity: 0, shape: 'circle', rot: 0, vrot: 0,
      });
    }
  }

  // KIDNAP — three sub-phases inside one beat:
  //   phase A (0.0–0.40): villain drags gf toward a cage at right
  //   phase B (0.40–0.60): door SLAMS shut on the cage
  //   phase C (0.60–1.00): dark smoke billows up, swallows them; they fade out
  _kidnap(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;

    // hero down-left, drained
    drawHero(ctx, W * 0.18, H * 0.92, 1.0, 1.0, 'down');

    // cage anchor (right side of frame)
    const cageX = W * 0.70;
    const cageY = H * 0.92;        // base/floor of cage
    const cageW = 240;
    const cageH = 320;

    const phaseA = Math.min(1, bt / 0.40);          // drag
    const phaseB = Math.max(0, Math.min(1, (bt - 0.40) / 0.20)); // door slam
    const phaseC = Math.max(0, (bt - 0.60) / 0.40); // smoke

    // Movement: villain & gf travel from mid-left to in front of cage
    const startX = W * 0.42;
    const targetX = cageX - 30;
    const villX = startX + (targetX - startX) * phaseA;
    const gfX = villX - 70;
    const inCageX = cageX + cageW / 2 - 35;

    // Decide gf position: phase A = walking; phase B = stuffed inside cage
    let gfDrawX, gfPose;
    if (phaseA < 1) { gfDrawX = gfX; gfPose = 'pulled'; }
    else { gfDrawX = inCageX; gfPose = 'cage'; }

    // Draw cage AFTER gf if she's still being dragged in (so bars overlay her)
    const drawCage = () => drawCage_(ctx, cageX, cageY, cageW, cageH, phaseB, phaseC);

    // Vanish opacity: fade to 0 over phase C
    const visible = 1 - Math.min(1, phaseC * 1.2);

    if (phaseA >= 1) {
      // gf inside cage — draw cage first (back bars), then gf (foreground), then re-draw front bars
      // to keep it simple, we just draw cage with both bars; gf alpha reduced by smoke
      drawGirlfriend(ctx, gfDrawX, cageY - 14, 0.85, visible, gfPose);
      drawCage();
    } else {
      // villain dragging her toward cage
      drawCage();
      drawGirlfriend(ctx, gfDrawX, cageY, 0.95, 1, gfPose);
    }
    // villain stays slightly to the right of gf during drag, then steps back to cast smoke
    const villainPose = phaseB > 0 ? 'cast' : 'walk';
    const villainX = phaseB > 0 ? cageX - 60 : villX;
    drawVillain(ctx, villainX, cageY, 1.05, visible, villainPose);

    // broken heart above the hero as gf is locked away
    if (phaseB > 0) {
      const bha = Math.min(1, phaseB * 5) * (1 - Math.min(1, phaseC * 1.8));
      if (bha > 0) drawBrokenHeart(ctx, W * 0.18 + 36, H * 0.92 - 300, 54, bha);
    }

    // SMOKE: starts faint at phase B (sealing door), explodes in phase C
    const smokeRate = 0.3 + phaseB * 0.4 + phaseC * 0.9;
    if (Math.random() < smokeRate) {
      this.particles.spawn({
        x: cageX + (Math.random()-.5) * cageW * 0.9,
        y: cageY - Math.random() * cageH * 0.9,
        vx: (Math.random()-.5) * 60,
        vy: -60 - Math.random() * 80,
        life: 1.6 + Math.random() * 0.8,
        max: 2.4,
        size: 26 + Math.random() * 28,
        color: `rgba(${10+Math.random()*30|0},${5+Math.random()*15|0},${15+Math.random()*25|0},0.65)`,
        gravity: -30,
        shape: 'circle', rot: 0, vrot: 0,
      });
    }
    // big swirl during phase C
    if (phaseC > 0 && Math.random() < phaseC * 1.5) {
      const a = this.lightT * 3 + Math.random() * Math.PI * 2;
      const r = 60 + Math.random() * 140;
      this.particles.spawn({
        x: cageX + cageW/2 + Math.cos(a) * r,
        y: cageY - cageH/2 + Math.sin(a) * r * 0.6,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 40,
        life: 1.4, max: 1.4, size: 36 + Math.random() * 30,
        color: 'rgba(8,4,12,0.7)', gravity: -30, shape: 'circle', rot: 0, vrot: 0,
      });
    }
    // shadow tendrils at phase B
    if (phaseB > 0 && Math.random() < 0.7) {
      this.particles.spawn({
        x: cageX + (Math.random()-.5)*cageW,
        y: cageY - 8,
        vx: (Math.random()-.5)*30, vy: -100 - Math.random()*60,
        life: 0.8, max: 0.8, size: 8, color: 'rgba(40,10,30,0.7)',
        gravity: -20, shape: 'circle', rot: 0, vrot: 0,
      });
    }
    // closing-vignette so the entire frame collapses around the cage during phase C
    if (phaseC > 0) {
      const vg = ctx.createRadialGradient(cageX + cageW/2, cageY - cageH/2,
        Math.max(20, 280 * (1 - phaseC)),
        cageX + cageW/2, cageY - cageH/2, 700);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(0.5, `rgba(0,0,0,${0.4 + 0.5 * phaseC})`);
      vg.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _rise(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const lift = Math.min(1, bt * 1.3);
    drawHero(ctx, W * 0.5, H * 0.92 - lift * 4, 1.0, 1.0, lift > 0.6 ? 'standDetermined' : 'kneel');
    const beam = ctx.createRadialGradient(W*0.5, H*0.5, 20, W*0.5, H*0.5, W*0.5);
    beam.addColorStop(0, `rgba(255,42,85,${0.18 + lift * 0.25})`);
    beam.addColorStop(1, 'rgba(255,42,85,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H);
    if (Math.random() < 0.6) {
      this.particles.spawn({
        x: W*0.5 + (Math.random()-.5)*200, y: H*0.92,
        vx: (Math.random()-.5)*30, vy: -120 - Math.random()*100,
        life: 1.4, max: 1.4, size: 3,
        color: '#ff2a55', gravity: -40, shape: 'circle', rot: 0, vrot: 0,
      });
    }

    // broken heart fades in early while hero grieves, then dissolves as anger takes over
    if (bt < 0.42) {
      const bha = Math.min(1, bt * 9) * (1 - bt / 0.42);
      if (bha > 0.02) drawBrokenHeart(ctx, W * 0.5, H * 0.92 - 360 - lift * 4, 58, bha);
    }
    // angry aura builds through the second half — hero finds his fury
    if (bt > 0.4) {
      const angryA = Math.min(1, (bt - 0.4) * 2.5);
      const headY = H * 0.92 - 285 - lift * 4;
      drawAngryAura(ctx, W * 0.5, headY, angryA, this.lightT);
      if (Math.random() < angryA * 0.85) {
        this.particles.spawn({
          x: W * 0.5 + (Math.random() - 0.5) * 130,
          y: headY + (Math.random() - 0.5) * 70,
          vx: (Math.random() - 0.5) * 190,
          vy: -95 - Math.random() * 110,
          life: 0.5, max: 0.5, size: 3,
          color: ['#ff2a55','#ff7a1a','#ffcc33'][(Math.random() * 3) | 0],
          gravity: 280, shape: 'square', rot: 0, vrot: (Math.random() - 0.5) * 10,
        });
      }
    }
  }

  _bossFall(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    drawHero(ctx, W*0.32, H*0.92, 1.0, 1.0, 'standDetermined');
    drawHooligan(ctx, W*0.62, H*0.92 + bt * 40, 1.0 - bt * 0.15, 1.0, bt);
    if (Math.random() < 0.6) {
      this.particles.spawn({
        x: W*0.62 + (Math.random()-.5)*100,
        y: H*0.74 + Math.random()*40,
        vx: (Math.random()-.5)*200, vy: -120 - Math.random()*120,
        life: 1.0, max: 1.0, size: 3,
        color: ['#ff7a1a','#ffcc33','#7a7a84'][(Math.random()*3)|0],
        gravity: 400, shape: 'square', rot: 0, vrot: (Math.random()-.5)*8,
      });
    }
  }

  _reunion(bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    drawHero(ctx, W*0.5, H*0.92, 1.0, 1.0, 'standDetermined');
  }

  // -- chrome --

  _drawText(beat, bt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    const fade = Math.min(1, bt * 3) * Math.min(1, (1 - bt) * 4);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    // double-stroke for legibility against complex bg
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 56px "Anton", sans-serif';
    ctx.fillText(beat.text.line, W / 2 + 2, H * 0.22 + 2);
    ctx.fillStyle = '#ff2a55';
    ctx.fillText(beat.text.line, W / 2, H * 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'italic 18px "JetBrains Mono", monospace';
    ctx.fillText(beat.text.sub, W / 2 + 1, H * 0.22 + 37);
    ctx.fillStyle = '#e8eef7';
    ctx.fillText(beat.text.sub, W / 2, H * 0.22 + 36);
    ctx.restore();
  }

  _drawLetterbox() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, 64);
    ctx.fillRect(0, H - 64, W, 64);
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(0, 64, W, 1);
    ctx.fillStyle = '#22e1ff';
    ctx.fillRect(0, H - 65, W, 1);
  }

  _drawSkipBtn() {
    const ctx = this.ctx;
    const b = this.skipBtn;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(232,238,247,0.6)';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 14px "Anton", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SKIP ▶', b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText('ENTER', b.x + b.w / 2, b.y + b.h + 12);
    ctx.restore();
  }

  _drawProgress() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const ratio = Math.min(1, this.t / this.duration);
    ctx.fillStyle = 'rgba(255,42,85,0.7)';
    ctx.fillRect(0, H - 2, W * ratio, 2);
  }
}

// ----- character rendering (cinematic, dramatic poses) -----

function placeholderFigure(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(-30, -180, 60, 120);
  ctx.fillRect(-18, -62, 18, 62);
  ctx.fillRect(2, -62, 18, 62);
  ctx.fillStyle = '#f3c79b';
  ctx.fillRect(-24, -224, 48, 48);
}

// HERO_H controls the protagonist size; bumped from 220 to 360.
const HERO_H = 360;
const GF_H = 320;
const VILLAIN_H = 380;

function drawHero(ctx, x, y, scale, alpha, pose = 'idle') {
  const img = Assets.get('mainChar');
  const real = Assets.isReal('mainChar');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  if (pose === 'cheer') ctx.translate(0, Math.sin(performance.now()/200) * 3);
  if (pose === 'kneel' || pose === 'down') {
    ctx.translate(0, 28);
    ctx.rotate(pose === 'down' ? -0.4 : 0);
  }
  if (pose === 'standDetermined') ctx.translate(0, -2);

  if (real) {
    const targetH = HERO_H * scale;
    const aspect = img.width / img.height;
    const targetW = targetH * aspect;
    ctx.drawImage(img, -targetW/2, -targetH, targetW, targetH);
    if (pose === 'cheer') {
      ctx.fillStyle = 'rgba(255,204,51,0.4)';
      ctx.beginPath(); ctx.arc(0, -targetH * 0.7, targetH * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    if (pose === 'standDetermined') {
      ctx.strokeStyle = '#ff2a55';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -targetH * 0.4, targetH * 0.55, 0, Math.PI*2); ctx.stroke();
    }
  } else {
    placeholderFigure(ctx, '#ff2a55');
  }
  ctx.restore();
}

function drawGirlfriend(ctx, x, y, scale, alpha, pose = 'idle') {
  const img = Assets.get('girlfriend');
  const real = Assets.isReal('girlfriend');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (pose === 'pulled') ctx.rotate(0.35);
  if (pose === 'shock') ctx.translate(0, Math.sin(performance.now()/120) * 1.8);
  if (pose === 'cage') ctx.translate(0, Math.sin(performance.now()/280) * 1.5);

  if (real) {
    const targetH = GF_H * scale;
    const aspect = img.width / img.height;
    const targetW = targetH * aspect;
    ctx.drawImage(img, -targetW/2, -targetH, targetW, targetH);
  } else {
    placeholderFigure(ctx, '#ffcc33');
  }
  ctx.restore();
}

function drawVillain(ctx, x, y, scale, alpha, pose = 'idle') {
  const img = Assets.get('villain');
  const real = Assets.isReal('villain');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // dark cloak silhouette (always)
  ctx.fillStyle = 'rgba(15,5,20,0.75)';
  const cloakH = 380 * scale;
  ctx.beginPath();
  ctx.moveTo(-130 * scale, 0);
  ctx.lineTo(130 * scale, 0);
  ctx.lineTo(80 * scale, -cloakH);
  ctx.lineTo(-80 * scale, -cloakH);
  ctx.closePath();
  ctx.fill();
  // glow halo
  const grad = ctx.createRadialGradient(0, -cloakH * 0.7, 5, 0, -cloakH * 0.7, 160 * scale);
  grad.addColorStop(0, 'rgba(255,42,85,0.5)');
  grad.addColorStop(1, 'rgba(255,42,85,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-180, -cloakH - 60, 360, cloakH + 80);

  if (real) {
    const targetH = VILLAIN_H * scale;
    const aspect = img.width / img.height;
    const targetW = targetH * aspect;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -targetH * 0.5, targetW/2 * 0.95, targetH * 0.5 * 0.95, 0, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(img, -targetW/2, -targetH, targetW, targetH);
    ctx.restore();
  } else {
    placeholderFigure(ctx, '#15091e');
  }

  if (pose === 'cast') {
    const px = -75 * scale, py = -cloakH * 0.55;
    ctx.fillStyle = '#ff2a55';
    ctx.beginPath(); ctx.arc(px, py, 12 + Math.sin(performance.now()/100) * 4, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// Draws a heavy iron cage. cageX/cageY = bottom-center of cage.
// doorT = 0 (open) → 1 (slammed shut). smokeT controls additional dim.
function drawCage_(ctx, cageX, cageY, cageW, cageH, doorT, smokeT) {
  ctx.save();
  ctx.translate(cageX, cageY);

  // floor base
  ctx.fillStyle = '#08070d';
  ctx.fillRect(-4, -4, cageW, 8);

  // back wall shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(8, -cageH + 6, cageW - 16, cageH - 12);

  // top frame (heavy iron beam with rivets)
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-8, -cageH, cageW + 16, 18);
  ctx.fillStyle = '#3a3a44';
  for (let i = 0; i < cageW; i += 22) {
    ctx.fillRect(i - 4, -cageH + 3, 3, 3);
    ctx.fillRect(i - 4, -cageH + 11, 3, 3);
  }

  // bottom frame
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-8, -8, cageW + 16, 14);
  ctx.fillStyle = '#3a3a44';
  for (let i = 0; i < cageW; i += 22) ctx.fillRect(i - 4, -2, 3, 3);

  // vertical bars
  ctx.fillStyle = '#2a2a32';
  const bars = 9;
  for (let i = 0; i <= bars; i++) {
    const bx = (i / bars) * cageW;
    ctx.fillRect(bx - 3, -cageH + 16, 6, cageH - 22);
    // rivet head at top
    ctx.fillStyle = '#5a5a64';
    ctx.fillRect(bx - 3, -cageH + 18, 6, 3);
    ctx.fillStyle = '#2a2a32';
  }
  // a horizontal cross-bar mid-cage
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(-4, -cageH * 0.55, cageW + 8, 6);

  // CAGE DOOR — front-left, swings shut over phase B (doorT 0→1)
  // door has its own bars; rotates around its right hinge from open (-0.9 rad) to closed (0)
  ctx.save();
  ctx.translate(0, 0);
  const angle = (1 - doorT) * -1.0; // -1 rad open, 0 closed
  ctx.translate(0, 0);
  ctx.rotate(angle);
  // door frame
  ctx.fillStyle = '#1c1c22';
  const doorW = cageW * 0.45;
  ctx.fillRect(0, -cageH + 16, 6, cageH - 22);                // hinge edge
  ctx.fillRect(0, -cageH + 16, doorW, 6);                     // top
  ctx.fillRect(0, -16, doorW, 6);                             // bottom
  // door bars
  ctx.fillStyle = '#2a2a32';
  for (let i = 1; i <= 4; i++) {
    const bx = (i / 4.5) * doorW;
    ctx.fillRect(bx - 2, -cageH + 22, 4, cageH - 38);
  }
  // lock
  if (doorT >= 0.95) {
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(doorW - 14, -cageH * 0.55, 8, 12);
    ctx.fillStyle = '#7a4a14';
    ctx.fillRect(doorW - 12, -cageH * 0.55 + 3, 4, 6);
  }
  ctx.restore();

  // slam impact streaks
  if (doorT > 0.85 && doorT < 0.99) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - (doorT - 0.85) / 0.14})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const yy = -cageH * (0.2 + Math.random() * 0.6);
      ctx.beginPath();
      ctx.moveTo(-30, yy);
      ctx.lineTo(-4, yy);
      ctx.stroke();
    }
  }

  // smoke darken inside cage during phase C
  if (smokeT > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.3 + smokeT * 0.5})`;
    ctx.fillRect(0, -cageH + 16, cageW, cageH - 22);
  }

  ctx.restore();
}

function drawHooligan(ctx, x, y, scale, alpha, fallT) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(0.5 + fallT * 0.4);
  const s = scale;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 90 * s, 12, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#2a0f12';
  ctx.fillRect(-70 * s, -180 * s, 140 * s, 140 * s);
  ctx.fillStyle = '#0a0a0a';
  for (let i = -50; i < 70; i += 44) ctx.fillRect(i * s, -180 * s, 14 * s, 140 * s);
  ctx.fillStyle = '#3a3a44';
  ctx.beginPath();
  ctx.moveTo(-80 * s, -180 * s); ctx.lineTo(-40 * s, -188 * s); ctx.lineTo(-36 * s, -154 * s); ctx.lineTo(-80 * s, -148 * s); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(80 * s, -180 * s); ctx.lineTo(40 * s, -188 * s); ctx.lineTo(36 * s, -154 * s); ctx.lineTo(80 * s, -148 * s); ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(0, -220 * s);
  ctx.rotate(0.3);
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(-44 * s, -38 * s, 88 * s, 70 * s);
  ctx.fillStyle = '#1f1f26';
  ctx.fillRect(-36 * s, -14 * s, 72 * s, 44 * s);
  const flicker = Math.max(0, 1 - fallT * 1.4);
  ctx.fillStyle = `rgba(255,122,26,${flicker * 0.8})`;
  ctx.fillRect(-24 * s, -2 * s, 16 * s, 4 * s);
  ctx.fillRect(  8 * s, -2 * s, 16 * s, 4 * s);
  ctx.strokeStyle = '#ff7a1a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-28 * s, -30 * s); ctx.lineTo(0, 8 * s); ctx.lineTo(28 * s, -22 * s);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawEnergyStream(ctx, x1, y1, x2, y2, t, intensity) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const phase = t * 4 + i * 1.2;
    ctx.strokeStyle = i === 0 ? '#fff7d6' : `rgba(255,${42 + i * 30},85,${0.4 - i * 0.06})`;
    ctx.lineWidth = (12 - i * 1.6) * (0.4 + intensity * 0.6);
    ctx.beginPath();
    const segs = 16;
    for (let s = 0; s <= segs; s++) {
      const u = s / segs;
      const x = x1 + (x2 - x1) * u + Math.sin(phase + u * 6) * 22;
      const y = y1 + (y2 - y1) * u + Math.cos(phase + u * 4) * 14;
      if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBrokenHeart(ctx, x, y, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = '#ff2a55';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#cc1a3a';
  ctx.font = `bold ${size}px "Georgia", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♥', x, y);
  ctx.shadowBlur = 0;
  // jagged crack down the middle
  ctx.strokeStyle = '#01010a';
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const h = size * 0.38;
  ctx.beginPath();
  ctx.moveTo(x + size * 0.04, y - h);
  ctx.lineTo(x + size * 0.12, y - h * 0.25);
  ctx.lineTo(x - size * 0.06, y + h * 0.15);
  ctx.lineTo(x + size * 0.10, y + h * 0.70);
  ctx.stroke();
  ctx.restore();
}

function drawAngryAura(ctx, x, y, alpha, t) {
  ctx.save();
  ctx.translate(x, y);
  // pulsing red halo ring
  const r = 56 + Math.sin(t * 11) * 7;
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = '#ff2a55';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  // radial energy spikes
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t * 1.9;
    const r1 = r + 5;
    const r2 = r + 14 + Math.sin(t * 9 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  // anger vein × marks (manga-style)
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ff2a55';
  ctx.font = `bold ${Math.floor(15 + alpha * 5)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×', -48, -53);
  ctx.fillText('×', 44, -56);
  // angry brow lines pointing inward
  ctx.strokeStyle = '#ff4455';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-32, -20); ctx.lineTo(-10, -29);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(32, -20); ctx.lineTo(10, -29);
  ctx.stroke();
  ctx.restore();
}
