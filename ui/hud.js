// HUD — comic-pulp design system.
// Top-left: hero portrait card with hearts + HYPE bar.
// Top-center: stage caption + boss-progress bar.
// Top-right: score / combo chip.
// Bottom-left: equipped weapon panel.
// Boss bar (when active): pulp banner along bottom.

import { drawWeaponIcon } from '../entities/weapon.js';
import { Assets } from '../core/assets.js';

const INK = '#0a0a12';
const INK_2 = '#14141f';
const PAPER = '#efe7d3';
const PAPER_2 = '#e8dec3';
const CAPTION = '#f5db7a';
const CAPTION_2 = '#e8c652';
const CURSE = '#c44a8c';
const CURSE_DEEP = '#6e2153';
const BLOOD = '#c8323a';
const BLOOD_DEEP = '#7a1a22';
const GREEN = '#5fa05a';
const GOLD = '#e8b04a';

export class HUD {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.toast = null;
    this.bossPulse = 0;
    this.t = 0;
  }

  showToast(text, time = 2.0) {
    this.toast = { text, t: time, max: time };
  }

  update(dt) {
    this.t += dt;
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    this.bossPulse += dt;
  }

  draw(ctx, W, H, { boss } = {}) {
    const p = this.player;

    // ===== Top-left: hero card =====
    drawHeroCard(ctx, p, 18, 18);

    // ===== Top-center: stage + progress to boss =====
    drawStageProgress(ctx, W, p, this.world, boss);

    // ===== Top-right: score + combo =====
    drawScoreCard(ctx, W, p);

    // ===== Bottom-left: weapon panel =====
    drawWeaponCard(ctx, p, 18, H - 100);

    // ===== Bottom-right: controls hint =====
    drawControlsHint(ctx, W, H);

    // ===== Toast / stage banner =====
    if (this.toast) drawToast(ctx, W, H, this.toast);

    // ===== Boss bar =====
    if (boss && boss.appeared && !boss.dead) {
      drawBossBar(ctx, W, H, boss, this.bossPulse);
    }
  }
}

// -------- helpers --------

function comicPanel(ctx, x, y, w, h, fill = INK, shadow = CURSE_DEEP) {
  // drop-shadow block
  ctx.fillStyle = shadow;
  ctx.fillRect(x + 4, y + 4, w, h);
  // panel
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  // ink border
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function comicTile(ctx, x, y, w, h, fill = PAPER) {
  ctx.fillStyle = INK;
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function chip(ctx, text, x, y, opts = {}) {
  const bg = opts.bg || INK;
  const fg = opts.fg || PAPER;
  const font = opts.font || 'bold 13px "Bangers", sans-serif';
  ctx.font = font;
  const padX = opts.padX || 9;
  const padY = opts.padY || 4;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + padX * 2;
  const h = (opts.h || 20);
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  return { w, h };
}

function drawHeart(ctx, x, y, full) {
  // 22x22 ink-outlined comic heart
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(11, 20);
  ctx.lineTo(1, 10);
  ctx.bezierCurveTo(1, 5, 6, 2, 11, 6);
  ctx.bezierCurveTo(16, 2, 21, 5, 21, 10);
  ctx.closePath();
  ctx.fillStyle = full ? BLOOD : '#5a5a66';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  if (full) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(7, 9, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawHeroCard(ctx, p, x, y) {
  const w = 320, h = 88;
  comicPanel(ctx, x, y, w, h, INK, CURSE_DEEP);

  // portrait disc
  const cx = x + 14, cy = y + 14;
  const ds = 60;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx + ds/2, cy + ds/2, ds/2, 0, Math.PI * 2);
  ctx.fillStyle = CURSE;
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + ds/2, cy + ds/2, ds/2 - 2, 0, Math.PI * 2);
  ctx.clip();
  const img = Assets.get('player');
  if (Assets.isReal('player')) {
    const aspect = img.width / img.height;
    const drawH = ds * 1.8;
    const drawW = drawH * aspect;
    ctx.drawImage(img, cx + ds/2 - drawW/2, cy - 6, drawW, drawH);
  } else {
    ctx.fillStyle = '#f3c79b';
    ctx.fillRect(cx + 10, cy + 6, ds - 20, ds - 12);
  }
  ctx.restore();

  // name
  ctx.fillStyle = PAPER;
  ctx.font = 'bold 14px "Oswald", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('BAKHIRA', x + 86, y + 8);

  // hearts row
  for (let i = 0; i < p.maxHealth; i++) {
    drawHeart(ctx, x + 86 + i * 28, y + 26, i < p.health);
  }

  // hype/health bar (using lives ratio + flash for now)
  const bw = 200, bh = 12;
  const bx = x + 86, by = y + 58;
  ctx.fillStyle = INK_2;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  // segments
  const pct = Math.max(0, Math.min(1, p.health / p.maxHealth));
  const grd = ctx.createLinearGradient(bx, by, bx + bw, by);
  grd.addColorStop(0, CURSE);
  grd.addColorStop(1, CAPTION);
  ctx.fillStyle = grd;
  ctx.fillRect(bx + 2, by + 2, (bw - 4) * pct, bh - 4);

  ctx.fillStyle = PAPER;
  ctx.font = 'bold 10px "VT323", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HP ' + p.health + '/' + p.maxHealth, bx + 6, by - 11);

  // x LIVES chip beneath
  ctx.save();
  ctx.translate(x, y + h + 6);
  chip(ctx, 'x' + Math.max(0, p.lives) + ' LIVES', 0, 0, { bg: CAPTION, fg: INK, font: 'bold 12px "Bangers", sans-serif' });
  ctx.restore();
}

function drawStageProgress(ctx, W, p, world, boss) {
  const cx = W / 2;
  const y = 22;

  // caption box
  const label = 'STAGE 01 · COASTAL CLIFFS';
  ctx.save();
  ctx.font = 'bold 13px "Special Elite", monospace';
  const m = ctx.measureText(label);
  const cw = Math.ceil(m.width) + 24;
  const ch = 26;
  const cxLeft = cx - cw / 2;
  // shadow
  ctx.fillStyle = INK;
  ctx.fillRect(cxLeft + 3, y + 3, cw, ch);
  ctx.fillStyle = CAPTION;
  ctx.fillRect(cxLeft, y, cw, ch);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(cxLeft + 1, y + 1, cw - 2, ch - 2);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, y + ch / 2 + 1);
  ctx.restore();

  // boss progress bar
  const bw = 320, bh = 12;
  const bx = cx - bw / 2, by = y + 36;
  // shadow
  ctx.fillStyle = INK;
  ctx.fillRect(bx + 3, by + 3, bw, bh);
  ctx.fillStyle = INK_2;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);

  let progress = 0;
  if (world && world.bossTriggerX && p) {
    progress = Math.max(0, Math.min(1, p.x / world.bossTriggerX));
  }
  if (boss && boss.appeared) progress = 1;
  ctx.fillStyle = CAPTION;
  ctx.fillRect(bx + 3, by + 3, (bw - 6) * progress, bh - 6);

  // crown marker at the right end
  ctx.fillStyle = CURSE;
  ctx.font = 'bold 20px "Bangers", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('♛', bx + bw + 4, by + bh);

  // player marker dot along the bar
  const pmx = bx + (bw - 6) * progress + 3;
  ctx.fillStyle = BLOOD;
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(pmx, by + bh / 2, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // label below
  ctx.fillStyle = PAPER;
  ctx.font = 'bold 10px "VT323", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(progress * 100) + '% TO BOSS', cx, by + bh + 14);
}

function drawScoreCard(ctx, W, p) {
  const w = 200, h = 88;
  const x = W - w - 18, y = 18;
  comicPanel(ctx, x, y, w, h, INK, CURSE_DEEP);

  ctx.fillStyle = PAPER;
  ctx.font = 'bold 11px "Oswald", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE', x + 12, y + 8);

  ctx.fillStyle = CAPTION;
  ctx.font = 'bold 28px "VT323", monospace';
  ctx.fillText(p.score.toString().padStart(7, '0'), x + 12, y + 20);

  ctx.fillStyle = PAPER;
  ctx.font = 'bold 11px "Oswald", sans-serif';
  ctx.fillText('COINS', x + 12, y + 50);

  ctx.fillStyle = GOLD;
  ctx.font = 'bold 22px "Bangers", sans-serif';
  ctx.fillText('x' + p.coins, x + 70, y + 60);

  // coin glyph
  ctx.beginPath();
  ctx.arc(x + 130, y + 64, 8, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawWeaponCard(ctx, p, x, y) {
  // tile (paper) for icon
  const ts = 64;
  comicTile(ctx, x, y, ts, ts, PAPER);
  ctx.save();
  ctx.translate(x + ts / 2, y + ts / 2);
  drawWeaponIcon(ctx, p.weapon.def.icon, 0, 0, 1, p.weapon.color, 1.0);
  ctx.restore();

  // info strip beside it
  const ix = x + ts + 10;
  ctx.fillStyle = PAPER;
  ctx.font = 'bold 11px "Oswald", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('IN HAND', ix, y + 4);

  ctx.fillStyle = CAPTION;
  ctx.font = 'bold 20px "Bangers", sans-serif';
  ctx.fillText(p.weapon.name.toUpperCase(), ix, y + 16);

  // ammo bar
  const bw = 160, bh = 8;
  const bx = ix, by = y + 42;
  ctx.fillStyle = INK;
  ctx.fillRect(bx + 2, by + 2, bw, bh);
  ctx.fillStyle = INK_2;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  if (p.weapon.isInfinite) {
    ctx.fillStyle = p.weapon.color || GREEN;
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 12px "Bangers", sans-serif';
    ctx.fillText('∞', bx + bw + 8, by + bh);
  } else {
    const max = p.weapon.def.ammo;
    const ratio = Math.max(0, p.weapon.ammo / max);
    ctx.fillStyle = ratio > 0.3 ? GREEN : BLOOD;
    ctx.fillRect(bx + 2, by + 2, (bw - 4) * ratio, bh - 4);
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 11px "VT323", monospace';
    ctx.fillText(p.weapon.ammo + '/' + max, bx + bw + 6, by + bh);
  }

  // weapon swap hint
  if (p.inventory.length > 1) {
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 9px "Special Elite", monospace';
    ctx.fillText('K · CYCLE', ix, by + bh + 8);
    for (let i = 0; i < p.inventory.length; i++) {
      const dx = ix + 70 + i * 12;
      ctx.beginPath();
      ctx.arc(dx, by + bh + 14, 4, 0, Math.PI * 2);
      ctx.fillStyle = i === p.weaponIndex ? p.weapon.color : 'rgba(239,231,211,0.25)';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

function drawControlsHint(ctx, W, H) {
  const items = [
    { k: '← →',  l: 'MOVE',  bg: PAPER, fg: INK },
    { k: '↑',    l: 'JUMP',  bg: PAPER, fg: INK },
    { k: 'SPACE',l: 'SWING', bg: BLOOD, fg: PAPER },
    { k: 'K',    l: 'SWAP',  bg: CURSE, fg: PAPER },
    { k: 'ESC',  l: 'PAUSE', bg: INK,   fg: PAPER },
  ];
  let x = W - 18;
  const y = H - 30;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 10px "Special Elite", monospace';
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    // label width
    const m = ctx.measureText(it.l);
    const lw = Math.ceil(m.width);
    // key chip
    ctx.font = 'bold 12px "Bangers", sans-serif';
    const km = ctx.measureText(it.k);
    const kw = Math.ceil(km.width) + 14;
    const kh = 18;
    // place chip then label, growing right-to-left
    x -= lw + 6;
    ctx.fillStyle = PAPER;
    ctx.font = 'bold 10px "Special Elite", monospace';
    ctx.fillText(it.l, x, y + 1);
    x -= kw + 4;
    ctx.fillStyle = INK;
    ctx.fillRect(x, y - kh / 2, kw, kh);
    ctx.fillStyle = it.bg;
    ctx.fillRect(x + 2, y - kh / 2 + 2, kw - 4, kh - 4);
    ctx.fillStyle = it.fg;
    ctx.font = 'bold 12px "Bangers", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(it.k, x + kw / 2, y + 1);
    ctx.textAlign = 'left';
    x -= 6;
  }
  ctx.restore();
}

function drawToast(ctx, W, H, toast) {
  const a = Math.min(1, toast.t / Math.max(0.1, toast.max) + 0.3);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = toast.text;
  ctx.font = 'bold 56px "Bangers", "Impact", sans-serif';
  const tx = W / 2;
  const ty = H * 0.30;
  // SFX-style stroked text
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, tx + 4, ty + 4);
  ctx.fillStyle = CURSE_DEEP;
  ctx.fillText(text, tx + 4, ty + 4);
  ctx.strokeText(text, tx, ty);
  ctx.fillStyle = CAPTION;
  ctx.fillText(text, tx, ty);
  ctx.restore();
}

function drawBossBar(ctx, W, H, boss, pulse) {
  const bw = Math.min(720, W * 0.6), bh = 22;
  const bx = (W - bw) / 2, by = H - 70;
  ctx.save();
  // label
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 11px "Oswald", sans-serif';
  ctx.fillStyle = PAPER;
  ctx.fillText('STAGE 01  ·  BOSS', W / 2, by - 36);

  // name with SFX-style stroke
  const name = (boss.def.name || 'BOSS').toUpperCase();
  ctx.font = 'bold 36px "Bangers", sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.strokeText(name, W / 2, by - 14);
  ctx.fillStyle = boss.phase === 2 ? BLOOD : PAPER;
  ctx.fillText(name, W / 2, by - 14);

  if (boss.def.subtitle) {
    ctx.font = 'bold 10px "Special Elite", monospace';
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.75;
    ctx.fillText(boss.def.subtitle.toUpperCase(), W / 2, by - 2);
    ctx.globalAlpha = 1;
  }

  // bar shadow + frame
  ctx.fillStyle = INK;
  ctx.fillRect(bx + 4, by + 4, bw, bh);
  ctx.fillStyle = INK_2;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);

  // fill
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  if (boss.phase === 2) {
    grad.addColorStop(0, CURSE); grad.addColorStop(1, BLOOD_DEEP);
  } else {
    grad.addColorStop(0, CAPTION); grad.addColorStop(1, BLOOD);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(bx + 3, by + 3, (bw - 6) * ratio, bh - 6);
  // pulse sheen
  ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.10 * Math.sin(pulse * 6)})`;
  ctx.fillRect(bx + 3, by + 3, (bw - 6) * ratio, (bh - 6) / 2);

  // tick marks
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 1; i < 10; i++) ctx.fillRect(bx + (bw * i / 10), by, 1, bh);

  // phase chip
  const phaseText = (boss.phase === 2 ? 'PHASE 02 · ENRAGED' : 'PHASE 01');
  ctx.font = 'bold 11px "Oswald", sans-serif';
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.fillText(phaseText, W / 2, by + bh / 2 + 4);

  ctx.restore();
}
