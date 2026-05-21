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
import { ComicIntro, StageSelect, WeaponsCatalog } from './ui/screens.js';

const STATES = Object.freeze({
  INTRO: 'INTRO', STORY: 'STORY', STAGE_SELECT: 'STAGE_SELECT', WEAPONS: 'WEAPONS',
  CUTSCENE: 'CUTSCENE', PLAYING: 'PLAYING',
  PAUSED: 'PAUSED', BOSS: 'BOSS', GAME_OVER: 'GAME_OVER', WIN: 'WIN', VICTORY: 'VICTORY',
  GOAL_REACHED: 'GOAL_REACHED', STAGE_TRANSITION: 'STAGE_TRANSITION',
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
    this.story = null;          // ComicIntro instance
    this.stageSelect = null;    // StageSelect instance
    this.weapons = null;        // WeaponsCatalog instance
    this.world = null;
    this.player = null;
    this.boss = null;
    this.hud = null;

    this.bossEntranceShakeT = 0;
    this.gameOverT = 0;
    this.winT = 0;
    this.replayBtn = null;
    this.congratsBtn = null;
    this.nextStageBtn = null;
    this.returnBtn = null;
    this.exitBtn = null;
    this.goalReached = false;
    this.stageTransitionT = 0;
    this.backgroundMusicLooping = false;
    this.backgroundMusicTimeout = null;

    canvas.addEventListener('pointerdown', (e) => this._onClick(e));

    this._preloadCommon();
  }

  _preloadCommon() {
    Assets.loadImage('hero',       '/assets/hero.png',                  'HERO');
    Assets.loadImage('villain',    '/assets/characters/villain.jpeg',   'VILLAIN');
    Assets.loadImage('girlfriend', '/assets/characters/girlfriend.png', 'GF');
    Assets.loadImage('player',     '/assets/hero.png',                  'PLAYER');
    Assets.loadImage('castleBg',   '/assets/castle-bg.png',             'CASTLE');
    Assets.loadImage('stage1Bg',   '/assets/1st-stage-bg.png',          'STAGE1');
    // enemy faces
    Assets.loadImage('face_enemy1', '/assets/enemies/enemy1.png', 'E1');
    Assets.loadImage('face_enemy2', '/assets/enemies/enemy2.png', 'E2');
    Assets.loadImage('face_enemy3', '/assets/enemies/enemy3.png', 'E3');
    Assets.loadImage('bossLvl1',    '/assets/enemies/boss-lvl1.png', 'BOSS');
    Assets.loadImage('bgLvl1',      '/assets/1st-stage-bg.png', 'BG');
    Assets.loadImage('fcb',         '/assets/fcb.jpg', 'FCB');

    // ── Narrative voice tracks (sequential channel) ──
    this.audio.register('game-start',       '/assets/audios/game-start.mp3');
    this.audio.register('enemy1-intro',     '/assets/audios/enemy1-intro.mp3');
    this.audio.register('enemy1-defeat',    '/assets/audios/enemy1-defeat.mp3');
    this.audio.register('enemy2-intro',     '/assets/audios/enemy2-intro.mp3');
    this.audio.register('enemy2-defeat',    '/assets/audios/enemy2-defeat.mp3');
    this.audio.register('enemy3-intro',     '/assets/audios/enemy3-intro.mp3');
    this.audio.register('enemy3-defeat',    '/assets/audios/enemy3-defeat.mp3');
    this.audio.register('between-enemies',  '/assets/audios/between enemies.mp3');
    this.audio.register('boss-lvl1-intro',  '/assets/audios/boss-lv-introl.mp3'); // filename has a typo, alias to a sensible name
    this.audio.register('boss-lvl1-defeat', '/assets/audios/boss-lvl1-defeat.mp3');
    this.audio.register('boss-lvl1-defeat2','/assets/audios/boss-lvl1-defeat2.mp3');

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
    this.audio.register('tense_music', '/assets/audios/Tense Music Look Behind You.mp3');
    this.audio.register('9alawane_behlawane', '/assets/audios/9alawane Behlawane Bakhira D Achraf Official Audio.mp3');
  }

  startIntro() {
    // The chat/intro panels now play before the START button on page load
    // (see the bootstrap below). Clicking START goes straight to gameplay.
    this._startGame();
  }

  // Auto-played once on page load, before the boot screen is revealed.
  showStory(onDone) {
    this._teardownMenuScreens();
    this._stopBgMusic();
    this.state = STATES.STORY;
    this.story = new ComicIntro(this.canvas, this.audio, () => {
      this.story && this.story.destroy(); this.story = null;
      this.state = STATES.INTRO;
      if (onDone) onDone();
    });
  }

  showStageSelect() {
    this._teardownMenuScreens();
    this._stopBgMusic();
    this.state = STATES.STAGE_SELECT;
    this.stageSelect = new StageSelect(this.canvas, this.audio,
      (idx) => {
        this.stageSelect && this.stageSelect.destroy(); this.stageSelect = null;
        // Only Stage 01 ships; anything else falls back to Stage 01.
        this._startGame();
      },
      () => {
        this.stageSelect && this.stageSelect.destroy(); this.stageSelect = null;
        this._returnToBoot();
      });
  }

  showWeapons() {
    this._teardownMenuScreens();
    this._stopBgMusic();
    this.state = STATES.WEAPONS;
    this.weapons = new WeaponsCatalog(this.canvas, this.audio, () => {
      this.weapons && this.weapons.destroy(); this.weapons = null;
      this._returnToBoot();
    });
  }

  _teardownMenuScreens() {
    if (this.story)       { this.story.destroy();       this.story = null; }
    if (this.stageSelect) { this.stageSelect.destroy(); this.stageSelect = null; }
    if (this.weapons)     { this.weapons.destroy();     this.weapons = null; }
    if (this.cutscene)    { this.cutscene.destroy();    this.cutscene = null; }
  }

  _stopBgMusic() {
    this.backgroundMusicLooping = false;
    if (this.backgroundMusicTimeout) {
      clearTimeout(this.backgroundMusicTimeout);
      this.backgroundMusicTimeout = null;
    }
  }

  _returnToBoot() {
    this._teardownMenuScreens();
    this._stopBgMusic();
    this.state = STATES.INTRO;
    const boot = document.getElementById('boot');
    if (boot) {
      boot.style.display = 'flex';
      // next frame to re-enable transition
      requestAnimationFrame(() => boot.classList.remove('hidden'));
    }
  }

  _startGame() {
    if (this.cutscene) { this.cutscene.destroy(); this.cutscene = null; }
    this.boss = null;
    this.goalReached = false;
    // Wipe any pending narrative voice lines from a previous attempt so the
    // new stage-start audio is the FIRST thing the player hears.
    if (this.audio.clearVoiceQueue) this.audio.clearVoiceQueue();
    this.world = new World(LEVEL1, this.audio, this.camera);
    this.player = new Player(LEVEL1.spawn.x, LEVEL1.spawn.y);
    this.world.setPlayer(this.player);
    this.camera.setWorld(LEVEL1.bounds.w, LEVEL1.bounds.h);
    this.camera.follow(this.player);
    this.hud = new HUD(this.player, this.world);
    this.hud.showToast('STAGE I — THE CURSED FOREST', 2.5);
    // Narrative sequence kicks off with the stage-start clip. Every subsequent
    // intro/defeat/between voice line queues behind it on the same channel.
    this.audio.playSequential('game-start');
    this.state = STATES.PLAYING;
  }

  _spawnBoss() {
    this.boss = new Boss(LEVEL1.bossSpawn.x, LEVEL1.bossSpawn.y);
    this.boss.trigger();
    this.world.setBoss(this.boss);
    this.bossEntranceShakeT = 1.0;
    this.camera.shake(20, 0.8);
    this.hud.showToast(this.boss.def.name.toUpperCase(), 2.5);
    // Boss intro narration intentionally muted for this iteration — we'll
    // add it back when we're past the enemy1 verification step.
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
    if (this.state === STATES.GOAL_REACHED) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      if (this.nextStageBtn && sx > this.nextStageBtn.x && sx < this.nextStageBtn.x+this.nextStageBtn.w &&
          sy > this.nextStageBtn.y && sy < this.nextStageBtn.y+this.nextStageBtn.h) {
        this.state = STATES.STAGE_TRANSITION;
        this.stageTransitionT = 0;
        this.audio.play('l7wa', { volume: 0.7 });
      }
      if (this.returnBtn && sx > this.returnBtn.x && sx < this.returnBtn.x+this.returnBtn.w &&
          sy > this.returnBtn.y && sy < this.returnBtn.y+this.returnBtn.h) {
        this.showStageSelect(); // MAP — go straight to stage select
      }
    }
    if (this.state === STATES.STAGE_TRANSITION) {
      const rect = this.canvas.getBoundingClientRect();
      const sx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const sy = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      // check exit button
      if (this.exitBtn && sx > this.exitBtn.x && sx < this.exitBtn.x+this.exitBtn.w &&
          sy > this.exitBtn.y && sy < this.exitBtn.y+this.exitBtn.h) {
        this.startIntro(); // exit to intro/menu
      } else {
        // click anywhere else to continue to next stage
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
      } else if (this.state === STATES.STAGE_SELECT || this.state === STATES.WEAPONS) {
        // ESC backs out of menu screens to the title.
        this._returnToBoot();
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
    if (this.state === STATES.STORY && this.story) {
      this.story.update(dt, Input);
      return;
    }
    if (this.state === STATES.STAGE_SELECT && this.stageSelect) {
      this.stageSelect.update(dt, Input);
      return;
    }
    if (this.state === STATES.WEAPONS && this.weapons) {
      this.weapons.update(dt, Input);
      return;
    }
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
    if (this.state === STATES.GOAL_REACHED || this.state === STATES.STAGE_TRANSITION) return;

    if (this.state === STATES.PLAYING || this.state === STATES.BOSS) {
      this.player.diedThisFrame = false;
      this.player.update(dt, this.world);
      // Enemies update themselves. The intro voice line is queued from
      // entities/enemy.js based on actual on-screen visibility — DO NOT
      // pre-empt that here with a distance-less audio.play, or the enemy's
      // `audioPlayed` flag flips to true on frame 1 (before it's visible) and
      // the real intro is silently skipped.
      for (const e of this.world.enemies) e.update(dt, this.world);
      if (this.boss) this.boss.update(dt, this.world);
      this.world.update(dt);
      this.camera.update(dt);
      this.hud.update(dt);

      // Death in the boss arena = full level restart from the very beginning.
      // Any lethal hit while sealed inside the room resets the whole stage.
      if (this.world.inBossArena && this.player.diedThisFrame && !this.player.dead) {
        this.hud.showToast('SEALED. STAGE RESTARTS.', 1.6);
        this._startGame();
        return;
      }

      // boss trigger
      if (!this.boss && this.world.bossPending) {
        this._spawnBoss();
      }
      // Boss defeated → straight to the stage tally screen. Defeat audios
      // intentionally muted for this iteration.
      if (this.boss && this.boss.dead && this.boss.deathT <= 0) {
        this.boss = null;
        this.world.setBoss(null);
        this.goalReached = true;
        this.state = STATES.GOAL_REACHED;
      }

      // player death
      if (this.player.dead) {
        this.state = STATES.GAME_OVER;
        this.gameOverT = 0;
      }

      // goal reached - only meaningful when the level has a flag (Stage 1 wins
      // via boss defeat instead, so the goal rect is moved off-screen).
      const g = this.world.goal;
      if (g && g.w > 0 && !this.goalReached &&
          this.player.x + this.player.w > g.x && this.player.x < g.x + g.w) {
        this.goalReached = true;
        this.backgroundMusicLooping = false;
        if (this.backgroundMusicTimeout) clearTimeout(this.backgroundMusicTimeout);
        this.state = STATES.GOAL_REACHED;
        this.audio.play('finition', { volume: 0.8 });
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
    if (this.state === STATES.STORY && this.story) {
      this.story.draw();
      return;
    }
    if (this.state === STATES.STAGE_SELECT && this.stageSelect) {
      this.stageSelect.draw();
      return;
    }
    if (this.state === STATES.WEAPONS && this.weapons) {
      this.weapons.draw();
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
    if (this.state === STATES.GOAL_REACHED) this._drawGoalReached();
    if (this.state === STATES.STAGE_TRANSITION) this._drawStageTransition();
  }

  _drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(10,10,18,0.78)';
    ctx.fillRect(0, 0, this.W, this.H);
    // halftone overlay
    drawHalftone(ctx, 0, 0, this.W, this.H, 0.18);

    drawComicTitle(ctx, this.W / 2, this.H / 2 - 30, 'PAUSED', {
      fill: '#f5db7a', stroke: '#0a0a12', shadow: '#6e2153', size: 110,
    });
    drawCaptionBox(ctx, this.W / 2, this.H / 2 + 60, 'PRESS  ESC  TO RESUME', { center: true });
  }

  _drawGameOver() {
    const ctx = this.ctx;
    const alpha = Math.min(0.92, this.gameOverT * 1.4);
    // radial blood backdrop
    const r = ctx.createRadialGradient(this.W/2, this.H/2, 80, this.W/2, this.H/2, this.W * 0.7);
    r.addColorStop(0, `rgba(42,14,20,${alpha})`);
    r.addColorStop(1, `rgba(10,6,8,${alpha})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, this.W, this.H);
    drawHalftone(ctx, 0, 0, this.W, this.H, 0.22);

    const wob = Math.sin(this.gameOverT * 2) * 3;
    drawComicTitle(ctx, this.W/2, this.H/2 - 50 + wob, 'STREAM', {
      fill: '#c8323a', stroke: '#0a0a12', shadow: '#5a0a10', size: 120,
    });
    drawComicTitle(ctx, this.W/2, this.H/2 + 60 + wob, 'ENDED.', {
      fill: '#c8323a', stroke: '#0a0a12', shadow: '#5a0a10', size: 120,
    });

    drawCaptionBox(ctx, this.W/2, this.H/2 + 140, 'THE TROLLS GOT YOU. SHE\'S STILL IN THERE.', {
      bg: '#c8323a', fg: '#efe7d3', center: true,
    });

    this.replayBtn = { x: this.W/2 - 130, y: this.H/2 + 180, w: 260, h: 56 };
    drawComicButton(ctx, this.replayBtn, '↻ RETRY', { bg: '#c8323a', fg: '#efe7d3' });

    ctx.fillStyle = '#efe7d3';
    ctx.font = 'bold 11px "Special Elite", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OR PRESS  ENTER  TO TRY AGAIN', this.W/2, this.replayBtn.y + this.replayBtn.h + 26);
  }

  _drawWin() {
    const ctx = this.ctx;
    // backdrop — radial caption/gold starburst over castle
    this.renderer.drawBackground(0, 0.016);
    ctx.fillStyle = 'rgba(10,10,18,0.82)';
    ctx.fillRect(0, 0, this.W, this.H);
    drawStarburst(ctx, this.W/2, this.H/2 - 20, Math.max(this.W, this.H) * 0.7, 0.45);
    drawHalftone(ctx, 0, 0, this.W, this.H, 0.18);

    // chip
    drawChip(ctx, 'STAGE 01 CLEARED', this.W/2, this.H/2 - 160, { center: true, bg: '#f5db7a', fg: '#0a0a12' });

    drawComicTitle(ctx, this.W/2, this.H/2 - 80, 'KNOCKOUT!', {
      fill: '#f5db7a', stroke: '#0a0a12', shadow: '#6e2153', size: 110,
    });

    // tally panel
    const panelW = 360, panelH = 130;
    const px = this.W/2 - panelW/2, py = this.H/2 + 10;
    drawPaperPanel(ctx, px, py, panelW, panelH);
    ctx.fillStyle = '#0a0a12';
    ctx.font = 'bold 13px "Oswald", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('STAGE TALLY', px + 16, py + 12);

    const rows = [
      ['SCORE', this.player.score.toString().padStart(6, '0')],
      ['COINS', 'x ' + this.player.coins],
      ['LIVES LEFT', Math.max(0, this.player.lives) + ' / 3'],
    ];
    ctx.font = '18px "VT323", monospace';
    for (let i = 0; i < rows.length; i++) {
      const ry = py + 38 + i * 22;
      ctx.fillStyle = '#0a0a12';
      ctx.textAlign = 'left';
      ctx.fillText(rows[i][0], px + 16, ry);
      ctx.textAlign = 'right';
      ctx.fillText(rows[i][1], px + panelW - 16, ry);
    }
    // total separator
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(px + 16, py + panelH - 30, panelW - 32, 2);
    ctx.font = 'bold 20px "Bangers", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', px + 16, py + panelH - 8);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c44a8c';
    ctx.fillText('+ ' + this.player.score.toString().padStart(6, '0'), px + panelW - 16, py + panelH - 8);

    this.replayBtn = { x: this.W/2 - 130, y: py + panelH + 24, w: 260, h: 54 };
    drawComicButton(ctx, this.replayBtn, '▶ PLAY AGAIN', { bg: '#c8323a', fg: '#efe7d3' });
  }

  _drawGoalReached() {
    const ctx = this.ctx;
    // backdrop — caption starburst over dark
    ctx.fillStyle = 'rgba(10,10,18,0.86)';
    ctx.fillRect(0, 0, this.W, this.H);
    drawStarburst(ctx, this.W/2, this.H/2 - 30, Math.max(this.W, this.H) * 0.75, 0.45);
    drawHalftone(ctx, 0, 0, this.W, this.H, 0.18);

    // chip
    drawChip(ctx, 'STAGE 01 CLEARED', this.W/2, this.H/2 - 220, { center: true, bg: '#f5db7a', fg: '#0a0a12' });

    // KNOCKOUT! title
    drawComicTitle(ctx, this.W/2, this.H/2 - 130, 'KNOCKOUT!', {
      fill: '#f5db7a', stroke: '#0a0a12', shadow: '#6e2153', size: 116,
    });

    // SFX burst BANG! over the corner
    ctx.save();
    ctx.translate(this.W/2 + 240, this.H/2 - 170);
    ctx.rotate(0.16);
    ctx.font = 'bold 60px "Bangers", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0a0a12';
    ctx.strokeText('BANG!', 4, 4);
    ctx.fillStyle = '#0a0a12';
    ctx.fillText('BANG!', 4, 4);
    ctx.strokeText('BANG!', 0, 0);
    ctx.fillStyle = '#c8323a';
    ctx.fillText('BANG!', 0, 0);
    ctx.restore();

    // tally panel
    const panelW = 380, panelH = 180;
    const px = this.W/2 - panelW/2, py = this.H/2 - 50;
    drawPaperPanel(ctx, px, py, panelW, panelH);
    ctx.fillStyle = '#0a0a12';
    ctx.font = 'bold 13px "Oswald", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('STAGE TALLY', px + 16, py + 12);

    const totalScore = this.player.score + this.player.coins * 10;
    const rows = [
      ['SUB TOKENS', 'x ' + this.player.coins],
      ['HP REMAINING', this.player.health + ' / ' + this.player.maxHealth],
      ['LIVES LEFT', Math.max(0, this.player.lives) + ' / 3'],
      ['SCORE', this.player.score.toString().padStart(6,'0')],
    ];
    ctx.font = '18px "VT323", monospace';
    for (let i = 0; i < rows.length; i++) {
      const ry = py + 38 + i * 24;
      ctx.fillStyle = '#0a0a12';
      ctx.textAlign = 'left';
      ctx.fillText(rows[i][0], px + 16, ry);
      ctx.textAlign = 'right';
      ctx.fillText(rows[i][1], px + panelW - 16, ry);
    }
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(px + 16, py + panelH - 36, panelW - 32, 2);
    ctx.font = 'bold 22px "Bangers", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL', px + 16, py + panelH - 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c44a8c';
    ctx.fillText('+ ' + totalScore.toString().padStart(6,'0'), px + panelW - 16, py + panelH - 12);

    // buttons
    this.nextStageBtn = { x: this.W/2 - 240, y: py + panelH + 22, w: 220, h: 54 };
    drawComicButton(ctx, this.nextStageBtn, '▶ NEXT STAGE', { bg: '#c8323a', fg: '#efe7d3' });

    this.returnBtn = { x: this.W/2 + 20, y: py + panelH + 22, w: 220, h: 54 };
    drawComicButton(ctx, this.returnBtn, 'MAP', { bg: '#f5db7a', fg: '#0a0a12' });
  }

  _playBackgroundMusicLoop() {
    if (!this.backgroundMusicLooping) return;
    this.audio.play('9alawane_behlawane', { volume: 0.25 });
    // restart after ~210 seconds (3.5 minutes - typical song length)
    this.backgroundMusicTimeout = setTimeout(() => this._playBackgroundMusicLoop(), 210000);
  }

  _drawStageTransition() {
    const ctx = this.ctx;
    // castle bg + tint
    const bg = Assets.get('castleBg');
    if (Assets.isReal('castleBg')) {
      const aspectImg = bg.width / bg.height;
      const aspectView = this.W / this.H;
      let dw, dh;
      if (aspectImg > aspectView) { dh = this.H * 1.05; dw = dh * aspectImg; }
      else { dw = this.W * 1.05; dh = dw / aspectImg; }
      ctx.drawImage(bg, (this.W - dw) / 2, (this.H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#0d1628';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.fillStyle = 'rgba(10,10,18,0.78)';
    ctx.fillRect(0, 0, this.W, this.H);
    drawHalftone(ctx, 0, 0, this.W, this.H, 0.18);

    drawChip(ctx, 'INTERMISSION', this.W/2, this.H/2 - 150, { center: true, bg: '#c44a8c', fg: '#efe7d3' });
    drawComicTitle(ctx, this.W/2, this.H/2 - 60, 'TO BE', {
      fill: '#f5db7a', stroke: '#0a0a12', shadow: '#6e2153', size: 96,
    });
    drawComicTitle(ctx, this.W/2, this.H/2 + 30, 'CONTINUED…', {
      fill: '#f5db7a', stroke: '#0a0a12', shadow: '#6e2153', size: 96,
    });

    this.exitBtn = { x: this.W/2 - 110, y: this.H/2 + 100, w: 220, h: 54 };
    drawComicButton(ctx, this.exitBtn, 'EXIT', { bg: '#f5db7a', fg: '#0a0a12' });

    const fadeAlpha = Math.sin(this.stageTransitionT * 2) * 0.3 + 0.7;
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.fillStyle = '#f5db7a';
    ctx.font = '22px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▼ CLICK TO CONTINUE', this.W/2, this.H - 40);
    ctx.restore();
  }

  start() {
    requestAnimationFrame((t) => { this.lastT = t; this.loop(t); });
  }
}

// ===== Comic-pulp drawing helpers (used by overlay screens) =====

function drawComicTitle(ctx, x, y, text, opts = {}) {
  const size = opts.size || 96;
  const fill = opts.fill || '#f5db7a';
  const stroke = opts.stroke || '#0a0a12';
  const shadow = opts.shadow || '#6e2153';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size}px "Bangers", "Impact", sans-serif`;
  ctx.lineJoin = 'round';
  // shadow stack (offset)
  ctx.lineWidth = Math.max(4, size * 0.06);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x + 6, y + 6);
  ctx.fillStyle = shadow;
  ctx.fillText(text, x + 6, y + 6);
  // foreground
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawCaptionBox(ctx, x, y, text, opts = {}) {
  ctx.save();
  ctx.font = 'bold 14px "Special Elite", monospace';
  const padX = 14, padY = 8;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + padX * 2;
  const h = 30;
  const left = opts.center ? x - w / 2 : x;
  const bg = opts.bg || '#f5db7a';
  const fg = opts.fg || '#0a0a12';
  // shadow
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(left + 3, y + 3, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(left, y, w, h);
  ctx.strokeStyle = '#0a0a12';
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + padX, y + h / 2 + 1);
  ctx.restore();
}

function drawChip(ctx, text, x, y, opts = {}) {
  ctx.save();
  const font = opts.font || 'bold 13px "Bangers", sans-serif';
  ctx.font = font;
  const padX = 10, padY = 4;
  const m = ctx.measureText(text);
  const w = Math.ceil(m.width) + padX * 2;
  const h = 22;
  const left = opts.center ? x - w / 2 : x;
  const bg = opts.bg || '#0a0a12';
  const fg = opts.fg || '#efe7d3';
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(left, y, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(left + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + padX, y + h / 2 + 1);
  ctx.restore();
}

function drawComicButton(ctx, rect, label, opts = {}) {
  const { x, y, w, h } = rect;
  const bg = opts.bg || '#c8323a';
  const fg = opts.fg || '#efe7d3';
  // drop shadow
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(x + 4, y + 4, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0a0a12';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px "Bangers", sans-serif';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function drawPaperPanel(ctx, x, y, w, h) {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(x + 5, y + 5, w, h);
  ctx.fillStyle = '#efe7d3';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0a0a12';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

function drawHalftone(ctx, x, y, w, h, alpha = 0.2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const step = 6;
  ctx.fillStyle = '#0a0a12';
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x; xx < x + w; xx += step) {
      ctx.beginPath();
      ctx.arc(xx, yy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawStarburst(ctx, cx, cy, radius, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  const slices = 36;
  for (let i = 0; i < slices; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const a1 = (i / slices) * Math.PI * 2;
    const a2 = ((i + 1) / slices) * Math.PI * 2;
    ctx.arc(0, 0, radius, a1, a2);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#f5db7a' : '#e8c652';
    ctx.fill();
  }
  ctx.restore();
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

function setStartLabel(text) {
  if (!startBtn) return;
  startBtn.innerHTML = `<span class="arrow">▶</span> ${text}`;
}

let progressed = false;
const update = () => {
  const p = Math.max(Assets.progress(), 0);
  if (loadbar) loadbar.style.width = `${(p * 100).toFixed(0)}%`;
  if (p >= 1 && !progressed) {
    progressed = true;
    startBtn.disabled = false;
    setStartLabel('START NEW STREAM');
  }
};
Assets.onProgress = update;

// Allow start regardless of progress after a short timeout, since placeholders are valid.
setTimeout(() => {
  if (!progressed) {
    progressed = true;
    startBtn.disabled = false;
    setStartLabel('START NEW STREAM');
  }
}, 1200);

function hideBoot() {
  boot.classList.add('hidden');
  setTimeout(() => boot.style.display = 'none', 600);
}

// Boot/menu screen is the FIRST thing the user sees on launch — no story
// scene plays before it. START goes straight into gameplay.
startBtn.addEventListener('click', () => {
  hideBoot();
  game.startIntro();
});

const stageBtn = document.getElementById('stageBtn');
if (stageBtn) {
  stageBtn.addEventListener('click', () => {
    hideBoot();
    game.showStageSelect();
  });
}

const weaponsBtn = document.getElementById('weaponsBtn');
if (weaponsBtn) {
  weaponsBtn.addEventListener('click', () => {
    hideBoot();
    game.showWeapons();
  });
}
