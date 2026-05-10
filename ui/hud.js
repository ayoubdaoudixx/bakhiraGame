// HUD — health hearts, lives, weapon + ammo, score, boss bar.

import { drawWeaponIcon } from '../entities/weapon.js';

export class HUD {
  constructor(player, world) {
    this.player = player;
    this.world = world;
    this.toast = null;     // {text, t, max}
    this.bossPulse = 0;
  }

  showToast(text, time = 2.0) {
    this.toast = { text, t: time, max: time };
  }

  update(dt) {
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    this.bossPulse += dt;
  }

  draw(ctx, W, H, { boss } = {}) {
    const p = this.player;

    // top-left frame: hearts + lives
    ctx.save();
    // brand strip
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 380, 76);
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(0, 0, 4, 76);
    ctx.fillStyle = '#22e1ff';
    ctx.fillRect(0, 76, 380, 1);

    // hearts
    for (let i = 0; i < p.maxHealth; i++) drawHeart(ctx, 20 + i * 30, 20, i < p.health);

    // lives
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('LIVES', 20, 50);
    ctx.fillStyle = '#22e1ff';
    ctx.font = 'bold 22px "Anton", sans-serif';
    ctx.fillText('×' + p.lives, 80, 44);

    // score + coins
    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('SCORE', 160, 50);
    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 22px "Anton", sans-serif';
    ctx.fillText(p.score.toString().padStart(6, '0'), 220, 44);

    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('COIN', 320, 18);
    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 18px "Anton", sans-serif';
    ctx.fillText('×' + p.coins, 320, 32);

    // weapon — top right
    const wx = W - 280, wy = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(wx, wy, 264, 64);
    ctx.fillStyle = p.weapon.color;
    ctx.fillRect(wx + 260, wy, 4, 64);
    // icon
    ctx.save();
    ctx.translate(wx + 28, wy + 32);
    drawWeaponIcon(ctx, p.weapon.def.icon, 0, 0, 1, p.weapon.color, 1.2);
    ctx.restore();
    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('WEAPON', wx + 70, wy + 14);
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 18px "Anton", sans-serif';
    ctx.fillText(p.weapon.name.toUpperCase(), wx + 70, wy + 30);
    // ammo bar
    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('AMMO', wx + 70, wy + 49);
    if (p.weapon.isInfinite) {
      ctx.fillStyle = p.weapon.color;
      ctx.font = 'bold 14px "Anton", sans-serif';
      ctx.fillText('∞', wx + 110, wy + 47);
    } else {
      const max = p.weapon.def.ammo;
      const w = 140, h = 6;
      const x = wx + 110, y = wy + 50;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = p.weapon.color;
      ctx.fillRect(x, y, w * (p.weapon.ammo / max), h);
      ctx.fillStyle = '#e8eef7';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(p.weapon.ammo + '/' + max, x + w, y - 4);
    }

    // weapon list strip (small dots)
    if (p.inventory.length > 1) {
      const sx = wx, sy = wy + 70;
      ctx.fillStyle = '#9aa3b2';
      ctx.textAlign = 'left';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText('K · CYCLE', sx, sy);
      for (let i = 0; i < p.inventory.length; i++) {
        const dotX = sx + 70 + i * 14;
        ctx.fillStyle = i === p.weaponIndex ? p.weapon.color : 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(dotX, sy + 4, 4, 0, Math.PI*2); ctx.fill();
      }
    }

    ctx.restore();

    // toast
    if (this.toast) {
      const a = Math.min(1, this.toast.t * 1.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px "Anton", sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(this.toast.text, W/2 + 2, H/2 - 158);
      ctx.fillStyle = '#ff2a55';
      ctx.fillText(this.toast.text, W/2, H/2 - 160);
      ctx.restore();
    }

    // boss bar
    if (boss && boss.appeared && !boss.dead) {
      drawBossBar(ctx, W, H, boss, this.bossPulse);
    }
  }
}

function drawHeart(ctx, x, y, full) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.9, 0.9);
  ctx.beginPath();
  ctx.moveTo(12, 6);
  ctx.bezierCurveTo(12, 0, 22, 0, 22, 8);
  ctx.bezierCurveTo(22, 14, 12, 22, 12, 22);
  ctx.bezierCurveTo(12, 22, 2, 14, 2, 8);
  ctx.bezierCurveTo(2, 0, 12, 0, 12, 6);
  ctx.closePath();
  ctx.fillStyle = full ? '#ff2a55' : 'rgba(255,42,85,0.18)';
  ctx.fill();
  if (full) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(8, 7, 1.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawBossBar(ctx, W, H, boss, pulse) {
  const bw = W * 0.6, bh = 16;
  const bx = (W - bw) / 2, by = H - 60;
  ctx.save();
  // label
  ctx.textAlign = 'center';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#9aa3b2';
  ctx.fillText('STAGE I  ·  BOSS', W / 2, by - 32);
  ctx.font = 'bold 28px "Anton", sans-serif';
  ctx.fillStyle = boss.phase === 2 ? '#ff7a1a' : '#e8eef7';
  ctx.fillText(boss.def.name.toUpperCase(), W / 2, by - 14);
  if (boss.def.subtitle) {
    ctx.font = 'italic 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#9aa3b2';
    ctx.fillText(boss.def.subtitle, W / 2, by - 4);
  }

  // bar bg
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(bx, by, bw, bh);

  // fill
  const ratio = Math.max(0, boss.hp / boss.maxHp);
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  if (boss.phase === 2) {
    grad.addColorStop(0, '#ff2a55'); grad.addColorStop(1, '#7a0a1a');
  } else {
    grad.addColorStop(0, '#ffcc33'); grad.addColorStop(1, '#ff2a55');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, bw * ratio, bh);
  // pulse
  ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.1 * Math.sin(pulse * 6)})`;
  ctx.fillRect(bx, by, bw * ratio, bh);

  // outline
  ctx.strokeStyle = boss.phase === 2 ? '#ff2a55' : '#22e1ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  // tick marks
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  for (let i = 1; i < 10; i++) ctx.fillRect(bx + (bw * i / 10), by, 1, bh);

  ctx.restore();
}
