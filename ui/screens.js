// Comic-pulp menu screens: Story Intro (6 panels), Stage Select, Weapons Catalog.
// All canvas-rendered to match the gameplay style. Click/keyboard driven.
//
// Each screen exposes:
//   update(dt, input)    — animate / advance state
//   draw()               — paint current frame
//   handlePointer(sx,sy) — translated (canvas-space) pointer; return action key or null
//   destroy()            — detach listeners
//
// All shared helpers (panel, chip, sfx burst, caption, halftone) live at the bottom.

import { Assets } from '../core/assets.js';
import { WEAPONS } from '../config/weapons.js';

const INK = '#0a0a12';
const INK_2 = '#14141f';
const PAPER = '#efe7d3';
const PAPER_2 = '#e8dec3';
const BONE = '#d8cdb0';
const NIGHT = '#0d1628';
const NIGHT_2 = '#1a2540';
const NIGHT_3 = '#243152';
const CAPTION = '#f5db7a';
const CAPTION_2 = '#e8c652';
const CURSE = '#c44a8c';
const CURSE_DEEP = '#6e2153';
const BLOOD = '#c8323a';
const BLOOD_DEEP = '#7a1a22';
const GREEN = '#5fa05a';
const GOLD = '#e8b04a';
const CYAN = '#5fb6c8';

// =====================================================================
//                     6-PANEL COMIC STORY INTRO
// =====================================================================
//
// Replaces the football cutscene with the streamer/Dreadmod story from
// the pitch design. Six static comic panels, each fades in with a
// typewriter caption; SPACE/CLICK advances; ESC skips the whole thing.

const PANELS = [
  { // 01 — streaming with GF
    num: '01',
    caption: 'TUESDAY NIGHT. THE STREAM IS POPPING.\n18 THOUSAND VIEWERS. HIS GIRL IS LAUGHING.',
    bubble: '"BABE — DROP A SUB IN CHAT,\nIT\'S BEEN A GOOD ONE."',
    bubblePos: { x: 0.30, y: 0.78, w: 360 },
    captionPos: { x: 0.04, y: 0.04, w: 480 },
    scene: 'streamRoom',
    audio: 'rwina',
  },
  { // 02 — chat goes weird
    num: '02',
    caption: 'THEN CHAT WENT QUIET...',
    captionPos: { x: 0.04, y: 0.04, w: 360 },
    scene: 'chatGlitch',
    audio: 'lhajwi',
  },
  { // 03 — villain appears
    num: '03',
    caption: 'A HOODED FIGURE STEPPED OUT OF THE MONITOR.',
    captionPos: { x: 0.04, y: 0.88, w: 720 },
    sfx: { text: 'CLACK!', x: 0.78, y: 0.18, size: 96, color: CURSE, rot: -0.14 },
    scene: 'villainAppear',
    audio: 'chno_tra_ya_wlad_lqhab',
  },
  { // 04 — kidnap
    num: '04',
    caption: 'HE TOOK HER. JUST LIKE THAT.',
    captionPos: { x: 0.04, y: 0.88, w: 540 },
    sfxBubble: { text: '"BABE—!!"', x: 0.68, y: 0.32, size: 56 },
    scene: 'kidnap',
    audio: 'chno_tra_ya_wlad_lqhab',
  },
  { // 05 — curse
    num: '05',
    caption: '"ENJOY THE CURSE, STREAMER."',
    captionPos: { x: 0.04, y: 0.04, w: 700 },
    captionStyle: { bg: CURSE, fg: PAPER },
    scene: 'curse',
    audio: 'l7w_bamos',
  },
  { // 06 — vow
    num: '06',
    caption: 'SOMEWHERE BY THE COAST... A CASTLE.\nHE GRABBED THE BAT.',
    captionPos: { x: 0.04, y: 0.86, w: 540 },
    bubble: '"I\'M COMING FOR HER.\nEVERY ONE OF YOU. STAGE BY STAGE."',
    bubblePos: { x: 0.58, y: 0.10, w: 420 },
    scene: 'vow',
    audio: 'bani_kalboun_layn3l_zaml_bok',
  },
];

export class ComicIntro {
  constructor(canvas, audio, onDone) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.audio = audio;
    this.onDone = onDone;
    this.idx = 0;
    this.panelT = 0;        // seconds since entering current panel
    this.done = false;
    this.skipBtn = { x: this.W - 130, y: 24, w: 110, h: 36 };
    this.nextBtn = { x: this.W / 2 - 110, y: this.H - 60, w: 220, h: 44 };

    this._pointer = (e) => this._onPointer(e);
    canvas.addEventListener('pointerdown', this._pointer);
    this._triggerAudio();
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._pointer);
  }

  _onPointer(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    if (hit(this.skipBtn, sx, sy)) { this._finish(); return; }
    if (hit(this.nextBtn, sx, sy)) { this._advance(); return; }
    // tap anywhere to advance once caption finished
    if (this.panelT > 0.6) this._advance();
  }

  _triggerAudio() {
    const a = PANELS[this.idx].audio;
    if (a && this.audio) this.audio.play(a, { volume: 0.55 });
  }

  _advance() {
    if (this.idx >= PANELS.length - 1) { this._finish(); return; }
    this.idx++;
    this.panelT = 0;
    this._triggerAudio();
  }

  _finish() {
    if (this.done) return;
    this.done = true;
    if (this.onDone) this.onDone();
  }

  update(dt, input) {
    if (this.done) return;
    this.panelT += dt;
    if (!input) return;
    // pressed() consumes — check each action exactly once per frame.
    const skip = input.pressed('skip');
    const advance = input.pressed('attack') || input.pressed('jump');
    if (skip) this._finish();
    else if (advance) this._advance();
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const p = PANELS[this.idx];

    // base
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);

    // scene
    switch (p.scene) {
      case 'streamRoom':    this._sceneStreamRoom(); break;
      case 'chatGlitch':    this._sceneChatGlitch(); break;
      case 'villainAppear': this._sceneVillainAppear(); break;
      case 'kidnap':        this._sceneKidnap(); break;
      case 'curse':         this._sceneCurse(); break;
      case 'vow':           this._sceneVow(); break;
    }

    // halftone over dark areas
    halftone(ctx, 0, 0, W, H, 0.18);

    // panel number watermark
    ctx.save();
    ctx.fillStyle = 'rgba(239,231,211,0.18)';
    ctx.font = 'bold 90px "Bangers", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(p.num, W - 24, H - 16);
    ctx.restore();

    // SFX burst (if any) — drawn over scene
    if (p.sfx) {
      const a = Math.min(1, this.panelT * 2.0);
      sfxBurst(ctx, W * p.sfx.x, H * p.sfx.y, p.sfx.text, {
        size: p.sfx.size, color: p.sfx.color, rot: p.sfx.rot, alpha: a,
      });
    }
    if (p.sfxBubble) {
      const a = Math.min(1, this.panelT * 2.0);
      sfxBurst(ctx, W * p.sfxBubble.x, H * p.sfxBubble.y, p.sfxBubble.text, {
        size: p.sfxBubble.size, color: PAPER, rot: -0.14, alpha: a,
      });
    }

    // caption (typewriter)
    if (p.caption) {
      const lines = p.caption.split('\n');
      const full = p.caption.length;
      const reveal = Math.floor(Math.min(1, this.panelT * 0.7) * full);
      let used = 0;
      const rev = lines.map((line) => {
        const take = Math.max(0, Math.min(line.length, reveal - used));
        used += line.length + 1; // +1 for newline
        return line.slice(0, take);
      });
      const cx = W * p.captionPos.x;
      const cy = H * p.captionPos.y;
      captionBox(ctx, cx, cy, p.captionPos.w, rev, p.captionStyle || {});
    }

    // bubble
    if (p.bubble) {
      const lines = p.bubble.split('\n');
      const cx = W * p.bubblePos.x;
      const cy = H * p.bubblePos.y;
      const a = Math.min(1, Math.max(0, this.panelT - 0.5) * 1.5);
      speechBubble(ctx, cx, cy, p.bubblePos.w, lines, a);
    }

    // letterbox + scanlines
    letterbox(ctx, W, H);
    scanlines(ctx, W, H, 0.06);

    // controls
    chip(ctx, 'ISSUE #1 · THE CURSE', 24, 24, { bg: INK, fg: PAPER });
    chip(ctx, `${this.idx + 1} / ${PANELS.length}`, 24, 52, { bg: CURSE, fg: PAPER });

    // skip button (top-right)
    drawButton(ctx, this.skipBtn, 'SKIP ▶', { bg: INK, fg: PAPER, fontSize: 16 });
    // next button (bottom-center)
    const last = this.idx === PANELS.length - 1;
    drawButton(ctx, this.nextBtn, last ? '▶ BEGIN' : '▶ NEXT PANEL  (SPACE)', { bg: BLOOD, fg: PAPER, fontSize: 18 });
  }

  // -------- scene painters --------
  _sceneStreamRoom() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // dark room gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a1f3a'); g.addColorStop(1, '#1a1226');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // monitor glow
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.5, 30, W * 0.5, H * 0.5, 460);
    glow.addColorStop(0, 'rgba(95,182,200,0.45)');
    glow.addColorStop(1, 'rgba(95,182,200,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // desk silhouette
    const desk = ctx.createLinearGradient(0, H * 0.55, 0, H);
    desk.addColorStop(0, 'rgba(0,0,0,0)'); desk.addColorStop(1, INK);
    ctx.fillStyle = desk; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    // monitor frame
    const mw = 380, mh = 240;
    const mx = W / 2 - mw / 2, my = H * 0.42 - mh / 2;
    ctx.fillStyle = INK; ctx.fillRect(mx - 10, my - 10, mw + 20, mh + 20);
    ctx.fillStyle = PAPER; ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = INK; ctx.fillRect(mx, my, mw, mh);
    const screen = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
    screen.addColorStop(0, '#5fb6c8'); screen.addColorStop(1, '#2a6f80');
    ctx.fillStyle = screen; ctx.fillRect(mx + 4, my + 4, mw - 8, mh - 8);
    ctx.fillStyle = INK;
    ctx.font = 'bold 44px "Bungee", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LIVE • 18K', mx + mw / 2, my + mh / 2);
    // pulse REC dot
    const pulse = 0.5 + 0.5 * Math.sin(this.panelT * 4);
    ctx.fillStyle = `rgba(200,50,58,${pulse})`;
    ctx.beginPath(); ctx.arc(mx + 30, my + 30, 10, 0, Math.PI * 2); ctx.fill();
    // hero silhouette left
    const hero = Assets.get('hero');
    if (Assets.isReal('hero')) {
      const h = H * 0.7, w = h * (hero.width / hero.height);
      ctx.save();
      ctx.filter = 'brightness(0.35) drop-shadow(0 0 30px rgba(95,182,200,0.5))';
      ctx.drawImage(hero, W * 0.18 - w / 2, H - h, w, h);
      ctx.restore();
    }
    // GF silhouette right
    const gf = Assets.get('girlfriend');
    if (Assets.isReal('girlfriend')) {
      const h = H * 0.55, w = h * (gf.width / gf.height);
      ctx.save();
      ctx.filter = 'brightness(0.30)';
      ctx.drawImage(gf, W * 0.82 - w / 2, H - h, w, h);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(W * 0.82, H * 0.95);
      // hooded silhouette stand-in
      ctx.fillStyle = '#1a1226';
      ctx.beginPath();
      ctx.moveTo(-60, 0); ctx.lineTo(60, 0); ctx.lineTo(50, -260); ctx.lineTo(-50, -260); ctx.closePath();
      ctx.fill();
      // halo
      ctx.fillStyle = '#f5db7a';
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, -290, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _sceneChatGlitch() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
    // chat panel
    const cx = W * 0.18, cy = H * 0.12, cw = W * 0.64, ch = H * 0.68;
    ctx.fillStyle = '#0a0814';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = '#5fb6c8';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3);
    // chat header
    ctx.fillStyle = '#0d1628';
    ctx.fillRect(cx, cy, cw, 36);
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 13px "Special Elite", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('STREAM CHAT · LIVE', cx + 14, cy + 18);
    ctx.fillStyle = BLOOD;
    ctx.beginPath(); ctx.arc(cx + cw - 18, cy + 18, 6, 0, Math.PI * 2); ctx.fill();

    // chat lines
    const lines = [
      { who: 'xX_p1xel',     msg: 'lmaoo classic',           col: CYAN, cursed: false },
      { who: 'g4mer42',      msg: 'W stream',                col: GOLD, cursed: false },
      { who: 'm0d_jenny',    msg: 'hi babe :3',              col: GREEN, cursed: false },
      { who: 'streamr_4ever',msg: 'best one yet',            col: '#aaa', cursed: false },
      { who: 'GLITCH',       msg: '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓', col: CURSE, cursed: true },
      { who: 'DREAD_M0D',    msg: 'i see you, streamer.',    col: CURSE, cursed: true },
      { who: 'DREAD_M0D',    msg: 'i\'m coming through.',    col: CURSE, cursed: true },
    ];
    const total = lines.length;
    const reveal = Math.min(total, Math.floor(this.panelT * 1.5));
    ctx.font = '18px "VT323", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (let i = 0; i < reveal; i++) {
      const l = lines[i];
      const ly = cy + 56 + i * 32;
      if (l.cursed) {
        ctx.shadowColor = CURSE; ctx.shadowBlur = 14;
      }
      ctx.fillStyle = l.col;
      ctx.fillText(l.who + ':', cx + 16, ly);
      ctx.fillStyle = l.cursed ? CURSE : PAPER;
      ctx.fillText(l.msg, cx + 16 + 180, ly);
      ctx.shadowBlur = 0;
    }
    // type indicator at bottom
    if (reveal === total) {
      const blink = Math.floor(this.panelT * 3) % 2;
      if (blink) {
        ctx.fillStyle = CURSE;
        ctx.fillText('DREAD_M0D is typing…', cx + 16, cy + ch - 32);
      }
    }
  }

  _sceneVillainAppear() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // radial curse backdrop
    const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 30, W * 0.5, H * 0.4, W * 0.7);
    g.addColorStop(0, CURSE); g.addColorStop(0.3, CURSE_DEEP); g.addColorStop(1, INK);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // hooded silhouette
    const cx = W * 0.5, by = H * 0.95;
    const hw = 360, hh = H * 0.88;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.16, by - hh);     // hood top-left
    ctx.lineTo(cx + hw * 0.16, by - hh);
    ctx.lineTo(cx + hw * 0.30, by - hh * 0.85);
    ctx.lineTo(cx + hw * 0.50, by);
    ctx.lineTo(cx - hw * 0.50, by);
    ctx.lineTo(cx - hw * 0.30, by - hh * 0.85);
    ctx.closePath();
    ctx.fill();
    // glowing eyes
    const eyeY = by - hh * 0.72;
    const pulse = 0.6 + 0.4 * Math.sin(this.panelT * 5);
    ctx.fillStyle = `rgba(245,219,122,${pulse})`;
    ctx.shadowColor = CAPTION; ctx.shadowBlur = 22;
    ctx.fillRect(cx - 38, eyeY, 22, 6);
    ctx.fillRect(cx + 16, eyeY, 22, 6);
    ctx.shadowBlur = 0;
    // electric crackles
    ctx.strokeStyle = CURSE;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + this.panelT * 2;
      const x0 = cx + Math.cos(a) * 80, y0 = eyeY + Math.sin(a) * 60;
      const x1 = cx + Math.cos(a) * 220, y1 = eyeY + Math.sin(a) * 180;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }

  _sceneKidnap() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2a1226'); g.addColorStop(1, '#1a0a16');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // motion lines
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(0.4);
    for (let i = -20; i < 20; i++) {
      const y = i * 14;
      ctx.fillStyle = `rgba(255,255,255,${0.04 + (Math.abs(i) < 5 ? 0.04 : 0)})`;
      ctx.fillRect(-W, y, W * 2, 4);
    }
    ctx.restore();
    // purple swoosh
    ctx.save();
    ctx.translate(W / 2, H * 0.3);
    ctx.rotate(-0.18);
    const sw = ctx.createLinearGradient(-W * 0.6, 0, W * 0.6, 0);
    sw.addColorStop(0, 'rgba(196,74,140,0)');
    sw.addColorStop(0.5, CURSE);
    sw.addColorStop(1, 'rgba(196,74,140,0)');
    ctx.fillStyle = sw;
    ctx.shadowColor = CURSE; ctx.shadowBlur = 30;
    ctx.fillRect(-W * 0.6, -6, W * 1.2, 12);
    ctx.restore();
    // small fading hero silhouette bottom-left
    const hero = Assets.get('hero');
    if (Assets.isReal('hero')) {
      const h = H * 0.5, w = h * (hero.width / hero.height);
      ctx.save();
      ctx.globalAlpha = 0.65;
      ctx.filter = 'brightness(0.25)';
      ctx.drawImage(hero, 60, H - h, w, h);
      ctx.restore();
    }
    // villain dragging gf — right side dark mass
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(W * 0.62, H);
    ctx.lineTo(W * 0.74, H * 0.40);
    ctx.lineTo(W * 0.86, H * 0.36);
    ctx.lineTo(W, H * 0.50);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // GF being yanked, gold dot
    ctx.fillStyle = CAPTION;
    ctx.beginPath(); ctx.arc(W * 0.80, H * 0.42, 12, 0, Math.PI * 2); ctx.fill();
  }

  _sceneCurse() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const g = ctx.createRadialGradient(W * 0.4, H * 0.6, 50, W * 0.4, H * 0.6, W);
    g.addColorStop(0, CURSE_DEEP); g.addColorStop(1, INK);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // hero silhouette center, on knees
    const hero = Assets.get('hero');
    if (Assets.isReal('hero')) {
      const h = H * 0.6, w = h * (hero.width / hero.height);
      ctx.save();
      ctx.filter = 'brightness(0.4) drop-shadow(0 0 28px rgba(196,74,140,0.7))';
      ctx.drawImage(hero, W / 2 - w / 2, H - h, w, h);
      ctx.restore();
    }
    // curse circle
    const cx = W / 2, cy = H * 0.62;
    const r = 200 + Math.sin(this.panelT * 2) * 10;
    ctx.strokeStyle = CURSE;
    ctx.lineWidth = 5;
    ctx.shadowColor = CURSE; ctx.shadowBlur = 40;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.panelT * 0.5);
    ctx.strokeStyle = CAPTION;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.arc(0, 0, r - 40, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // sigil glyphs on the circle
    ctx.fillStyle = CAPTION;
    ctx.font = 'bold 28px "Bangers", sans-serif';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const tx = Math.cos(a) * (r - 70);
      const ty = Math.sin(a) * (r - 70);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a + Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(['×', '✦', '×', '✦', '×', '✦', '×', '✦'][i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  _sceneVow() {
    const ctx = this.ctx, W = this.W, H = this.H;
    const bg = Assets.get('castleBg');
    if (Assets.isReal('castleBg')) {
      const aspect = bg.width / bg.height;
      const aspectV = W / H;
      let dw, dh;
      if (aspect > aspectV) { dh = H * 1.05; dw = dh * aspect; }
      else { dw = W * 1.05; dh = dw / aspect; }
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, W, H);
    }
    // dramatic gradient overlay
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(10,10,18,0.85)');
    g.addColorStop(0.6, 'rgba(10,10,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // hero standing dramatic
    const hero = Assets.get('hero');
    if (Assets.isReal('hero')) {
      const h = H * 0.95, w = h * (hero.width / hero.height);
      ctx.save();
      ctx.filter = 'drop-shadow(8px 0 0 #0a0a12) drop-shadow(-3px 0 0 #0a0a12)';
      ctx.drawImage(hero, -w * 0.05, H - h, w, h);
      ctx.restore();
    }
  }
}

// =====================================================================
//                      STAGE SELECT (3x2 grid)
// =====================================================================
//
// Only Stage 01 is unlocked & playable (the only level shipped). The
// rest are visible but locked, exactly as the pitch shows.

const STAGES = [
  { num: '01', name: 'THE STREAM ROOM', sub: 'TUTORIAL · COZY GONE WRONG', boss: 'MOD_JENNY',     locked: false, current: true },
  { num: '02', name: 'DARKWEB ALLEY',   sub: 'BACKSTREET TROLLS',         boss: 'SIR_PINGS',     locked: true },
  { num: '03', name: 'COASTAL CLIFFS',  sub: 'APPROACH TO THE CASTLE',    boss: 'KRAKEN_88',     locked: true },
  { num: '04', name: 'CASTLE GATES',    sub: 'GUARDS OF THE GATEKEEP',    boss: 'WARDEN_VIRGIL', locked: true },
  { num: '05', name: 'DUNGEON HALLS',   sub: 'TORCHES & TICKETS',         boss: 'RNG_GHOUL',     locked: true },
  { num: '06', name: 'THRONE ROOM',     sub: 'FINAL CONFRONTATION',       boss: 'THE DREADMOD',  locked: true, isFinal: true },
];

export class StageSelect {
  constructor(canvas, audio, onChoose, onBack) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.audio = audio;
    this.onChoose = onChoose; // (stageIndex) => void
    this.onBack = onBack;
    this.t = 0;
    this.hover = -1;
    this.tiles = [];
    this.backBtn = { x: 24, y: this.H - 60, w: 130, h: 44 };

    this._pointer = (e) => this._onPointer(e);
    this._move = (e) => this._onMove(e);
    canvas.addEventListener('pointerdown', this._pointer);
    canvas.addEventListener('pointermove', this._move);
    this._layout();
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._pointer);
    this.canvas.removeEventListener('pointermove', this._move);
  }

  _layout() {
    const left = 32, right = 32, top = 170, bottom = 70;
    const gap = 18, cols = 3, rows = 2;
    const gridW = this.W - left - right;
    const gridH = this.H - top - bottom;
    const tileW = (gridW - gap * (cols - 1)) / cols;
    const tileH = (gridH - gap * (rows - 1)) / rows;
    this.tiles = STAGES.map((s, i) => ({
      stage: s,
      i,
      x: left + (i % cols) * (tileW + gap),
      y: top + Math.floor(i / cols) * (tileH + gap),
      w: tileW,
      h: tileH,
    }));
  }

  _onMove(e) {
    const { sx, sy } = canvasCoords(this.canvas, e);
    this.hover = -1;
    for (const t of this.tiles) if (hit(t, sx, sy) && !t.stage.locked) { this.hover = t.i; break; }
  }

  _onPointer(e) {
    const { sx, sy } = canvasCoords(this.canvas, e);
    if (hit(this.backBtn, sx, sy)) { this.onBack && this.onBack(); return; }
    for (const t of this.tiles) {
      if (hit(t, sx, sy) && !t.stage.locked) {
        if (this.audio) this.audio.play('l7wa', { volume: 0.6 });
        this.onChoose && this.onChoose(t.i);
        return;
      }
    }
  }

  update(dt, input) {
    this.t += dt;
    if (input && input.pressed('skip')) {
      // ENTER picks the current/first unlocked stage
      const idx = STAGES.findIndex(s => !s.locked);
      if (idx >= 0) this.onChoose && this.onChoose(idx);
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // background — castle desaturated
    const bg = Assets.get('castleBg');
    if (Assets.isReal('castleBg')) {
      const a = bg.width / bg.height;
      const va = W / H;
      let dw, dh;
      if (a > va) { dh = H * 1.05; dw = dh * a; }
      else { dw = W * 1.05; dh = dw / a; }
      ctx.save();
      ctx.filter = 'saturate(0.5) brightness(0.45)';
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, W, H);
    }
    // tint
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,10,18,0.6)');
    g.addColorStop(1, 'rgba(10,10,18,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H, 0.12);

    // header
    chip(ctx, 'SELECT YOUR STAGE', 32, 32, { bg: INK, fg: PAPER });
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 56px "Bangers", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.strokeText('THE ROAD TO HER', 32 + 4, 60 + 4);
    ctx.fillStyle = CURSE_DEEP; ctx.fillText('THE ROAD TO HER', 32 + 4, 60 + 4);
    ctx.strokeText('THE ROAD TO HER', 32, 60);
    ctx.fillStyle = PAPER; ctx.fillText('THE ROAD TO HER', 32, 60);
    ctx.restore();

    // progress chip top-right
    const cleared = STAGES.filter(s => !s.locked && !s.current).length; // crude
    const caption = `PROGRESS · ${cleared} / 6 CLEARED`;
    captionBox(ctx, W - 290, 36, 250, [caption]);

    // tiles
    for (const t of this.tiles) this._drawTile(t);

    // back button
    drawButton(ctx, this.backBtn, '◀ BACK', { bg: CAPTION, fg: INK });
    // hint
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.font = '12px "Special Elite", monospace';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('CLICK A STAGE TO ENTER  ·  ENTER = STAGE 01', W - 32, H - 38);
    ctx.restore();

    scanlines(ctx, W, H, 0.05);
  }

  _drawTile(t) {
    const ctx = this.ctx;
    const s = t.stage;
    const hovered = this.hover === t.i;
    // shadow + body
    ctx.fillStyle = INK;
    ctx.fillRect(t.x + 5, t.y + 5, t.w, t.h);
    ctx.fillStyle = s.isFinal ? CURSE_DEEP : (s.current ? CAPTION : PAPER);
    if (s.locked) ctx.fillStyle = '#2a2a35';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3);

    // art area (top 60%)
    const aH = t.h * 0.60;
    const ax = t.x, ay = t.y, aw = t.w;
    const ag = ctx.createLinearGradient(ax, ay, ax, ay + aH);
    if (s.isFinal) {
      ag.addColorStop(0, CURSE); ag.addColorStop(1, INK);
    } else if (s.locked) {
      ag.addColorStop(0, '#2a2a35'); ag.addColorStop(1, '#14141f');
    } else {
      ag.addColorStop(0, NIGHT_3); ag.addColorStop(1, NIGHT);
    }
    ctx.fillStyle = ag;
    ctx.fillRect(ax + 3, ay + 3, aw - 6, aH - 3);
    halftone(ctx, ax, ay, aw, aH, 0.18);
    // big stage num
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = 'bold 96px "Bangers", sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(s.num, ax + aw - 16, ay + 6);
    ctx.restore();

    if (s.locked) {
      ctx.save();
      ctx.fillStyle = PAPER;
      ctx.globalAlpha = 0.7;
      ctx.font = 'bold 36px "Bangers", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒 LOCKED', ax + aw / 2, ay + aH / 2);
      ctx.restore();
    } else {
      // mini scene preview — paper hero + two blood mobs
      const baseY = ay + aH * 0.85;
      ctx.fillStyle = PAPER;
      ctx.fillRect(ax + 24, baseY - 44, 28, 44);
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.strokeRect(ax + 24 + 0.5, baseY - 44 + 0.5, 27, 43);
      for (let i = 0; i < 2; i++) {
        const ex = ax + 70 + i * 30;
        ctx.fillStyle = BLOOD;
        ctx.fillRect(ex, baseY - 30, 22, 30);
        ctx.strokeRect(ex + 0.5, baseY - 30 + 0.5, 21, 29);
      }
      if (s.isFinal) {
        ctx.fillStyle = CURSE;
        ctx.fillRect(ax + aw - 70, baseY - 60, 48, 60);
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
        ctx.strokeRect(ax + aw - 70 + 1.5, baseY - 60 + 1.5, 45, 57);
      }
      if (s.current) {
        sfxBurst(ctx, ax + 60, ay + 32, 'YOU!', { size: 24, color: CAPTION, rot: -0.1 });
      }
    }

    // info area (bottom 40%)
    const ix = t.x + 14, iy = t.y + aH + 4;
    const ifg = s.isFinal ? PAPER : INK;
    ctx.fillStyle = ifg;
    ctx.font = 'bold 22px "Bangers", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(s.name, ix, iy);
    ctx.font = '13px "VT323", monospace';
    ctx.globalAlpha = 0.85;
    ctx.fillText(s.sub, ix, iy + 24);
    ctx.globalAlpha = 1;
    ctx.font = '11px "Special Elite", monospace';
    ctx.fillText('BOSS · ' + s.boss, ix, iy + 46);

    // action chip
    if (!s.locked) {
      const label = s.current ? 'ENTER ▶' : 'PLAY';
      const cw = label.length * 9 + 18;
      const cx = t.x + t.w - cw - 14;
      const cy = t.y + t.h - 28;
      const cBg = s.isFinal ? CAPTION : BLOOD;
      const cFg = s.isFinal ? INK : PAPER;
      const offset = hovered ? -2 : 0;
      ctx.fillStyle = INK;
      ctx.fillRect(cx + 2, cy + 2, cw, 20);
      ctx.fillStyle = cBg;
      ctx.fillRect(cx + offset, cy + offset, cw, 20);
      ctx.fillStyle = cFg;
      ctx.font = 'bold 12px "Bangers", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx + cw / 2 + offset, cy + 10 + offset + 1);
    }

    // hover frame
    if (hovered) {
      ctx.save();
      ctx.strokeStyle = CAPTION; ctx.lineWidth = 4;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(t.x - 4, t.y - 4, t.w + 8, t.h + 8);
      ctx.restore();
    }
  }
}

// =====================================================================
//                      WEAPONS & PICKUPS CATALOG
// =====================================================================
//
// Mirrors screens-3 from the design. Uses the ACTUAL weapons in
// config/weapons.js (the player's loadout pool) so the catalog is true
// to gameplay, not just to the pitch fiction.

const PICKUPS = [
  { name: 'HEART',        what: '+1 HP',         col: BLOOD,   icon: '♥' },
  { name: 'COIN',         what: '+1 COIN · SCORE', col: GOLD,  icon: '$' },
  { name: 'EXTRA LIFE',   what: '+1 LIFE',       col: GREEN,   icon: '★' },
  { name: 'HYPE',         what: '+25 HYPE',      col: CURSE,   icon: '▮' },
  { name: 'PIZZA',        what: '+2 HP (RARE)',  col: GOLD,    icon: '▲' },
  { name: 'CHAT SHIELD',  what: '10s INVULN',    col: PAPER,   icon: '◆' },
];

const RAR_FOR = {
  bat: 'STARTER', fist: 'STARTER',
  foamFinger: 'COMMON', explodingBoot: 'RARE',
  boomerang: 'UNCOMMON', whistle: 'EPIC',
  confetti: 'RARE', magicCleat: 'LEGENDARY',
};

const RAR_COL = {
  STARTER: '#9aa0a8', COMMON: '#9aa0a8',
  UNCOMMON: GREEN, RARE: CYAN, EPIC: CURSE, LEGENDARY: GOLD,
};

const WEAPON_BLURBS = {
  bat:           'His own bat. Reliable. Sentimental.',
  fist:          'Last resort. Knuckles to the chat.',
  foamFinger:    'Soft on the outside, ban on the inside.',
  explodingBoot: 'Yeet it. Pray for AOE. Pray harder.',
  boomerang:     'Red card thrown — comes back swinging.',
  whistle:       'Blow it. Stun the lobby. Win the room.',
  confetti:      'Rapid-fire celebration. Confetti hurts.',
  magicCleat:    'Locks on, refuses to miss. Cleat magic.',
};

const WEAPON_ICON_GLYPHS = {
  bat: '▬', fist: '✊', foamFinger: '☞', explodingBoot: '🥾',
  boomerang: '↺', whistle: '◐', confetti: '✸', magicCleat: '✦',
};

export class WeaponsCatalog {
  constructor(canvas, audio, onBack) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.audio = audio;
    this.onBack = onBack;
    this.t = 0;
    this.backBtn = { x: 24, y: this.H - 60, w: 130, h: 44 };

    this._pointer = (e) => this._onPointer(e);
    canvas.addEventListener('pointerdown', this._pointer);
  }

  destroy() {
    this.canvas.removeEventListener('pointerdown', this._pointer);
  }

  _onPointer(e) {
    const { sx, sy } = canvasCoords(this.canvas, e);
    if (hit(this.backBtn, sx, sy)) { this.onBack && this.onBack(); }
  }

  update(dt, input) {
    this.t += dt;
    if (input && (input.pressed('skip') || input.pressed('pause'))) {
      this.onBack && this.onBack();
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    // paper backdrop with halftone
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H, 0.10);

    // header
    chip(ctx, '06 · WEAPONS & PICKUPS', 32, 32, { bg: INK, fg: PAPER });
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = 'bold 44px "Bangers", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('ARMORY', 32, 60);
    ctx.fillStyle = CURSE;
    ctx.fillText(' & LOOT', 32 + ctx.measureText('ARMORY').width, 60);
    ctx.restore();
    captionBox(ctx, W - 410, 60, 370, [
      'WEAPONS BREAK ON USE — DURABILITY DRIVES',
      'THE LOOP. GRAB WHATEVER\'S ON THE GROUND.',
    ]);

    // weapons grid — 4 cols x 2 rows
    const ids = Object.keys(WEAPONS);
    const cols = 4, rows = Math.ceil(ids.length / cols);
    const gap = 14;
    const gridW = W - 64;
    const gridH = 340;
    const tw = (gridW - gap * (cols - 1)) / cols;
    const th = (gridH - gap * (rows - 1)) / rows;
    const startX = 32, startY = 130;
    for (let i = 0; i < ids.length; i++) {
      const x = startX + (i % cols) * (tw + gap);
      const y = startY + Math.floor(i / cols) * (th + gap);
      this._drawWeaponCard(ids[i], x, y, tw, th);
    }

    // pickups panel
    const py = startY + rows * (th + gap) + 6;
    const pH = H - py - 90;
    this._drawPickupsPanel(32, py, W - 64, pH);

    // back
    drawButton(ctx, this.backBtn, '◀ BACK', { bg: CAPTION, fg: INK });
  }

  _drawWeaponCard(id, x, y, w, h) {
    const ctx = this.ctx;
    const def = WEAPONS[id];
    const rar = RAR_FOR[id] || 'COMMON';
    // tile
    ctx.fillStyle = INK; ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    // art band
    const ah = h * 0.45;
    const g = ctx.createLinearGradient(x, y, x, y + ah);
    g.addColorStop(0, NIGHT_3); g.addColorStop(1, NIGHT);
    ctx.fillStyle = g; ctx.fillRect(x + 3, y + 3, w - 6, ah - 3);
    halftone(ctx, x, y, w, ah, 0.22);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y + ah, w, 3);
    // icon glyph
    ctx.save();
    ctx.fillStyle = def.color || PAPER;
    ctx.shadowColor = def.color || PAPER;
    ctx.shadowBlur = 16;
    ctx.font = 'bold 64px "Bangers", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(WEAPON_ICON_GLYPHS[id] || '?', x + w / 2, y + ah / 2);
    ctx.restore();
    // rarity chip
    chip(ctx, rar, x + 8, y + 8, { bg: RAR_COL[rar], fg: INK, font: 'bold 10px "Bangers", sans-serif' });

    // info
    const ix = x + 12, iy = y + ah + 8;
    ctx.fillStyle = INK;
    ctx.font = 'bold 18px "Bangers", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const name = def.name.toUpperCase();
    ctx.fillText(name, ix, iy);
    ctx.font = '10px "VT323", monospace';
    ctx.globalAlpha = 0.7;
    ctx.fillText((def.type || '').toUpperCase(), ix, iy + 22);
    ctx.globalAlpha = 1;
    // blurb
    ctx.font = '11px "Special Elite", monospace';
    const blurb = WEAPON_BLURBS[id] || '';
    wrapText(ctx, blurb, ix, iy + 38, w - 24, 13);
    // stats
    const sy = y + h - 32;
    drawStatRow(ctx, ix, sy,     'DMG', def.damage || 1, 6);
    drawStatRow(ctx, ix, sy + 12, 'AMMO', def.ammo === Infinity ? '∞' : (def.ammo + ''));
  }

  _drawPickupsPanel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = INK; ctx.fillRect(x + 4, y + 4, w, h);
    ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    ctx.fillStyle = INK;
    ctx.font = 'bold 26px "Bangers", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('CONSUMABLE PICKUPS', x + 14, y + 10);
    ctx.font = '11px "VT323", monospace';
    ctx.globalAlpha = 0.7;
    ctx.fillText('SPAWN ON KILL · ON CRATE SMASH · IN HIDDEN ROOMS', x + 260, y + 18);
    ctx.globalAlpha = 1;

    // 6 across
    const items = PICKUPS;
    const gap = 10;
    const cols = items.length;
    const cw = (w - 28 - gap * (cols - 1)) / cols;
    const ch = h - 60;
    const sx = x + 14;
    const sy = y + 46;
    for (let i = 0; i < cols; i++) {
      const it = items[i];
      const ix = sx + i * (cw + gap);
      ctx.fillStyle = INK;
      ctx.fillRect(ix, sy, cw, ch);
      ctx.fillStyle = PAPER_2;
      ctx.fillRect(ix + 2, sy + 2, cw - 4, ch - 4);
      // icon disc
      const ds = Math.min(56, ch - 30);
      const cx_ = ix + cw / 2, cy_ = sy + 16 + ds / 2;
      ctx.fillStyle = INK;
      ctx.fillRect(cx_ - ds / 2 - 2, cy_ - ds / 2 - 2, ds + 4, ds + 4);
      ctx.fillStyle = it.col;
      ctx.fillRect(cx_ - ds / 2, cy_ - ds / 2, ds, ds);
      ctx.fillStyle = INK;
      ctx.font = 'bold 26px "Bangers", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.icon, cx_, cy_ + 2);
      // text
      ctx.font = 'bold 12px "Oswald", sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(it.name, cx_, cy_ + ds / 2 + 12);
      ctx.font = '11px "VT323", monospace';
      ctx.fillText(it.what, cx_, cy_ + ds / 2 + 28);
    }
  }
}

// =====================================================================
//                              HELPERS
// =====================================================================

function hit(r, sx, sy) {
  return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
}

function canvasCoords(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return {
    sx: (e.clientX - rect.left) * (canvas.width / rect.width),
    sy: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function halftone(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = INK;
  const step = 6;
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      ctx.beginPath(); ctx.arc(xx, yy, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function chip(ctx, text, x, y, opts = {}) {
  ctx.save();
  const font = opts.font || 'bold 13px "Bangers", sans-serif';
  ctx.font = font;
  const padX = opts.padX || 10;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + padX * 2;
  const h = opts.h || 22;
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = opts.bg || INK;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = opts.fg || PAPER;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.restore();
}

function captionBox(ctx, x, y, w, lines, opts = {}) {
  ctx.save();
  const bg = opts.bg || CAPTION;
  const fg = opts.fg || INK;
  ctx.font = 'bold 13px "Special Elite", monospace';
  const lineH = 16;
  const padX = 12, padY = 8;
  const h = padY * 2 + lineH * lines.length;
  // shadow
  ctx.fillStyle = INK; ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillStyle = bg;  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = fg;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, y + padY + i * lineH);
  }
  ctx.restore();
}

function speechBubble(ctx, x, y, w, lines, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 18px "Bangers", sans-serif';
  const lineH = 22;
  const padX = 16, padY = 12;
  const h = padY * 2 + lineH * lines.length;
  // body
  roundRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = PAPER; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.stroke();
  // tail
  ctx.beginPath();
  ctx.moveTo(x + 40, y + h - 2);
  ctx.lineTo(x + 60, y + h + 18);
  ctx.lineTo(x + 80, y + h - 2);
  ctx.closePath();
  ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
  // text
  ctx.fillStyle = INK;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x + padX, y + padY + i * lineH);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function sfxBurst(ctx, x, y, text, opts = {}) {
  ctx.save();
  ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
  ctx.translate(x, y);
  ctx.rotate(opts.rot || -0.08);
  const size = opts.size || 64;
  const fill = opts.color || CAPTION;
  ctx.font = `bold ${size}px "Bangers", "Impact", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // ink-shadow
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(4, size * 0.08);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 6, 6);
  ctx.fillStyle = INK;
  ctx.fillText(text, 6, 6);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawButton(ctx, rect, label, opts = {}) {
  const { x, y, w, h } = rect;
  const bg = opts.bg || BLOOD;
  const fg = opts.fg || PAPER;
  ctx.fillStyle = INK; ctx.fillRect(x + 4, y + 4, w, h);
  ctx.fillStyle = bg;  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${opts.fontSize || 20}px "Bangers", sans-serif`;
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function letterbox(ctx, W, H) {
  const bh = 48;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, bh);
  ctx.fillRect(0, H - bh, W, bh);
  ctx.fillStyle = CURSE;
  ctx.fillRect(0, bh, W, 1);
  ctx.fillRect(0, H - bh - 1, W, 1);
}

function scanlines(ctx, W, H, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = INK;
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

function drawStatRow(ctx, x, y, label, value, max) {
  ctx.save();
  ctx.font = '10px "Special Elite", monospace';
  ctx.fillStyle = INK;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(label, x, y);
  if (typeof value === 'number') {
    const dotR = 4;
    for (let i = 0; i < (max || 6); i++) {
      const dx = x + 40 + i * (dotR * 2 + 2);
      ctx.beginPath(); ctx.arc(dx + dotR, y + 5, dotR, 0, Math.PI * 2);
      ctx.fillStyle = i < value ? INK : 'rgba(0,0,0,0)';
      ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    }
  } else {
    ctx.font = 'bold 11px "VT323", monospace';
    ctx.fillText(value, x + 40, y);
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word + ' ';
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
