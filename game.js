// Main loop + state machine.
// States: INTRO → CUTSCENE → PLAYING → PAUSED → BOSS → GAME_OVER → WIN

import { Assets } from './core/assets.js';
import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Renderer } from './engine/renderer.js';
import { Camera } from './engine/camera.js';
import { World } from './engine/world.js';
import { Player } from './entities/player.js';
import { Boss } from './entities/boss.js';
import { LEVEL1 } from './levels/level1.js';
import { HUD } from './ui/hud.js';
import { Cutscene } from './ui/cutscene.js';

const STATES = Object.freeze({
  INTRO: 'INTRO', CUTSCENE: 'CUTSCENE', PLAYING: 'PLAYING',
  PAUSED: 'PAUSED', BOSS: 'BOSS', GAME_OVER: 'GAME_OVER', WIN: 'WIN', VICTORY: 'VICTORY',
});

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.state = STATES.INTRO;
    this.renderer = new Renderer(canvas);
    this.camera = new Camera(this.W, this.H);
    this.audio = Audio;
    this.audio.bindUnlock();

    this.lastT = performance.now();
    this.acc = 0;
    this.fixedDt = 1 / 60;

    this.cutscene = null;
    this.world = null;
    this.player = null;
    this.boss = null;
    this.hud = null;

    this.bossEntranceShakeT = 0;
    this.gameOverT = 0;
    this.winT = 0;
    this.replayBtn = null;

    canvas.addEventListener('pointerdown', (e) => this._onClick(e));

    this._preloadCommon();
  }

  _preloadCommon() {
    Assets.loadImage('hero',       '/assets/characters/hero.png',       'HERO');
    Assets.loadImage('villain',    '/assets/characters/villain.jpeg',   'VILLAIN');
    Assets.loadImage('girlfriend', '/assets/characters/girlfriend.png', 'GF');
    Assets.loadImage('player',     '/assets/characters/main-character.png', 'PLAYER');
    // enemy faces
    Assets.loadImage('face_enemy1', '/assets/enemies/enemy1-face.jpeg', 'E1');
    Assets.loadImage('face_enemy2', '/assets/enemies/enemy2-face.jpeg', 'E2');
    Assets.loadImage('face_enemy3', '/assets/enemies/enemy3-face.jpeg', 'E3');
    Assets.loadImage('bossLvl1',    '/assets/characters/boss-Lvl1.png', 'BOSS');
    Assets.loadImage('bgLvl1',      '/assets/bg-lvl1.jpg', 'BG');

    // register all audio tracks
    this.audio.register('rwina', '/assets/audios/1- rwina.mp3');
    this.audio.register('chno_tra_ya_wlad_lqhab', '/assets/audios/1- chno tra ya wlad lqhab.mp3');
    this.audio.register('bani_kalboun_layn3l_zaml_bok', '/assets/audios/1- bani kalboun layn3l zaml bok.mp3');
    this.audio.register('l7w_bamos', '/assets/audios/1- l7w abamos.mp3');
    this.audio.register('wld_fayza', '/assets/audios/1- wld fayza.mp3');
    this.audio.register('wa_3la_krita', '/assets/audios/1- Wa 3la krita.mp3');
    this.audio.register('finition', '/assets/audios/1- finition.mp3');
    this.audio.register('bnsnss', '/assets/audios/1- bnsns.mp3');
    this.audio.register('bnsns_hziti_lqlwa', '/assets/audios/1- bnsns hziti lqlwa.mp3');
    this.audio.register('kbir_lqhab', '/assets/audios/1- kbir lqhab.mp3');
    this.audio.register('l7wa', '/assets/audios/1- L7wa.mp3');
    this.audio.register('carayou_pouuwa_lghwat', '/assets/audios/1- carayou pouuwa lghwat.mp3');
    this.audio.register('lhajwi', '/assets/audios/1-lhajwi.mp3');
  }

  startIntro() {
    this.state = STATES.CUTSCENE;
    this.cutscene = new Cutscene(this.canvas, 'intro', this.audio, () => {
      this._startGame();
    });
  }

  _startGame() {
    if (this.cutscene) { this.cutscene.destroy(); this.cutscene = null; }
    this.world = new World(LEVEL1, this.audio, this.camera);
    this.player = new Player(LEVEL1.spawn.x, LEVEL1.spawn.y);
    this.world.setPlayer(this.player);
    this.camera.setWorld(LEVEL1.bounds.w, LEVEL1.bounds.h);
    this.camera.follow(this.player);
    this.hud = new HUD(this.player, this.world);
    this.hud.showToast('STAGE I — THE STOLEN GAME', 2.5);
    this.audio.play('l7w_bamos');
    this.state = STATES.PLAYING;
  }

  _spawnBoss() {
    this.boss = new Boss(LEVEL1.bossSpawn.x, LEVEL1.bossSpawn.y);
    this.boss.trigger();
    this.world.setBoss(this.boss);
    this.bossEntranceShakeT = 1.0;
    this.camera.shake(20, 0.8);
    this.hud.showToast(this.boss.def.name.toUpperCase(), 2.5);
    // play boss entrance audio with proper spacing
    this.audio.play('kbir_lqhab');
    setTimeout(() => this.audio.play('bani_kalboun_layn3l_zaml_bok'), 2000);
    this.state = STATES.BOSS;
  }

  _onClick(e) {
    if (this.state === STATES.GAME_OVER || this.state === STATES.WIN) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const b = this.replayBtn;
      if (b && sx > b.x && sx < b.x+b.w && sy > b.y && sy < b.y+b.h) {
        this.startIntro();
      }
    }
  }

  _handleGlobalInput() {
    if (Input.pressed('pause')) {
      if (this.state === STATES.PLAYING || this.state === STATES.BOSS) {
        this.prevState = this.state;
        this.state = STATES.PAUSED;
      } else if (this.state === STATES.PAUSED) {
        this.state = this.prevState || STATES.PLAYING;
      }
    }
    if ((this.state === STATES.GAME_OVER || this.state === STATES.WIN) && Input.pressed('skip')) {
      this.startIntro();
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.acc += dt;

    this._handleGlobalInput();

    // step
    while (this.acc >= this.fixedDt) {
      this._update(this.fixedDt);
      this.acc -= this.fixedDt;
    }
    this._draw();
    Input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  _update(dt) {
    if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.cutscene.update(dt, Input);
      return;
    }
    if (this.state === STATES.PAUSED) return;
    if (this.state === STATES.GAME_OVER) { this.gameOverT += dt; return; }
    if (this.state === STATES.WIN || this.state === STATES.VICTORY) {
      this.winT += dt;
      if (this.cutscene) this.cutscene.update(dt, Input);
      return;
    }

    if (this.state === STATES.PLAYING || this.state === STATES.BOSS) {
      this.player.update(dt, this.world);
      // enemies
      for (const e of this.world.enemies) {
        // play enemy audio when first encountered
        if (!e.audioPlayed && e.audioAppear && this.audio) {
          e.audioPlayed = true;
          this.audio.play(e.audioAppear);
        }
        e.update(dt, this.world);
      }
      if (this.boss) this.boss.update(dt, this.world);
      this.world.update(dt);
      this.camera.update(dt);
      this.hud.update(dt);

      // boss trigger
      if (!this.boss && this.world.bossPending) {
        this._spawnBoss();
      }
      // boss defeated → win cutscene
      if (this.boss && this.boss.dead && this.boss.deathT <= 0) {
        // play victory audio with proper spacing
        this.audio.play('finition');
        setTimeout(() => this.audio.play('l7wa'), 2000);
        this.boss = null;
        this.world.setBoss(null);
        this.state = STATES.VICTORY;
        this.winT = 0;
        this.cutscene = new Cutscene(this.canvas, 'victory', this.audio, () => {
          this.state = STATES.WIN;
        });
      }

      // player death
      if (this.player.dead) {
        this.state = STATES.GAME_OVER;
        this.gameOverT = 0;
      }

      // goal reached (and boss already defeated would be required, but level1 ends with boss)
      // For redundancy, if player reaches the goal area without triggering boss, trigger it.
      const g = this.world.goal;
      if (!this.boss && this.world.bossPending === undefined && this.player.x + this.player.w > g.x && this.player.x < g.x + g.w) {
        // already covered by bossTriggerX — placeholder
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    if (this.state === STATES.INTRO) {
      // boot screen lives in DOM; canvas just shows a moody backdrop.
      this.renderer.drawBackground(0, 0.016);
      return;
    }
    if (this.state === STATES.CUTSCENE && this.cutscene) {
      this.cutscene.draw();
      return;
    }
    if (this.state === STATES.VICTORY && this.cutscene) {
      this.cutscene.draw();
      return;
    }

    // World render
    this.renderer.drawBackground(this.camera.x, this.fixedDt);

    ctx.save();
    this.camera.apply(ctx);
    // ground decorative strip beneath the level
    this.renderer.drawGround(this.camera.x - 0, this.world.bounds.w, this.world.level.groundY + 340);
    this.world.draw(ctx);
    for (const e of this.world.enemies) e.draw(ctx);
    if (this.boss) this.boss.draw(ctx);
    this.player.draw(ctx);
    ctx.restore();

    // fog overlays in zones (drawn on screen-space too)
    let fogA = 0;
    for (const z of this.world.zones) {
      if (z.kind !== 'fog') continue;
      // if camera intersects zone, slightly darken whole screen for atmosphere
      const camRight = this.camera.x + this.W;
      const overlap = Math.min(camRight, z.x + z.w) - Math.max(this.camera.x, z.x);
      if (overlap > 0) fogA = Math.max(fogA, z.alpha * 0.5);
    }
    if (fogA > 0) this.renderer.drawFog(fogA);

    // HUD
    this.hud.draw(ctx, this.W, this.H, { boss: this.boss });

    // overlays
    if (this.state === STATES.PAUSED) this._drawPause();
    if (this.state === STATES.GAME_OVER) this._drawGameOver();
    if (this.state === STATES.WIN) this._drawWin();
  }

  _drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22e1ff';
    ctx.font = 'bold 96px "Anton", sans-serif';
    ctx.fillText('PAUSED', this.W/2, this.H/2 - 10);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText('PRESS  P  TO RESUME', this.W/2, this.H/2 + 30);
  }

  _drawGameOver() {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.85, this.gameOverT)})`;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    const wob = Math.sin(this.gameOverT * 2) * 4;
    ctx.fillStyle = '#ff2a55';
    ctx.font = 'bold 120px "Anton", sans-serif';
    ctx.fillText('YOU FELL', this.W/2, this.H/2 - 30 + wob);
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'italic 18px "JetBrains Mono", monospace';
    ctx.fillText('but the night is not over.', this.W/2, this.H/2 + 12);

    this.replayBtn = { x: this.W/2 - 110, y: this.H/2 + 50, w: 220, h: 48 };
    const b = this.replayBtn;
    ctx.fillStyle = 'rgba(255,42,85,0.15)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ff2a55';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 22px "Anton", sans-serif';
    ctx.fillText('REPLAY', this.W/2, b.y + 32);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillText('OR PRESS  ENTER', this.W/2, b.y + b.h + 18);
  }

  _drawWin() {
    const ctx = this.ctx;
    // dark backdrop with stars
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, this.W, this.H);
    this.renderer.drawBackground(0, 0.016);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc33';
    ctx.font = 'bold 110px "Anton", sans-serif';
    ctx.fillText('STAGE CLEAR', this.W/2, this.H/2 - 20);
    ctx.fillStyle = '#22e1ff';
    ctx.font = 'bold 22px "Anton", sans-serif';
    ctx.fillText('THE NEXT SHADOW WAITS…', this.W/2, this.H/2 + 18);

    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText('SCORE: ' + this.player.score.toString().padStart(6,'0') + '   ·   COINS: ' + this.player.coins, this.W/2, this.H/2 + 50);

    this.replayBtn = { x: this.W/2 - 110, y: this.H/2 + 80, w: 220, h: 48 };
    const b = this.replayBtn;
    ctx.fillStyle = 'rgba(255,204,51,0.15)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#ffcc33';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#e8eef7';
    ctx.font = 'bold 22px "Anton", sans-serif';
    ctx.fillText('PLAY AGAIN', this.W/2, b.y + 32);
  }

  start() {
    requestAnimationFrame((t) => { this.lastT = t; this.loop(t); });
  }
}

// --- Bootstrap ---

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;
game.start();

// resize-aware fit
function fit() {
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  // keep an internal 1280x720 backbuffer; CSS scales to viewport
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
}
window.addEventListener('resize', fit);
fit();

// Boot UI handoff
const boot = document.getElementById('boot');
const startBtn = document.getElementById('startBtn');
const loadbar = document.querySelector('#loadbar > div');

let progressed = false;
const update = () => {
  const p = Math.max(Assets.progress(), 0);
  if (loadbar) loadbar.style.width = `${(p * 100).toFixed(0)}%`;
  if (p >= 1 && !progressed) {
    progressed = true;
    startBtn.disabled = false;
    startBtn.textContent = 'BEGIN';
  }
};
Assets.onProgress = update;

// Allow start regardless of progress after a short timeout, since placeholders are valid.
setTimeout(() => {
  startBtn.disabled = false;
  if (startBtn.textContent === 'LOADING…') startBtn.textContent = 'BEGIN';
}, 1200);

startBtn.addEventListener('click', () => {
  boot.classList.add('hidden');
  setTimeout(() => boot.style.display = 'none', 600);
  game.startIntro();
});
