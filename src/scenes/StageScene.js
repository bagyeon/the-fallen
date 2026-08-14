import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';

export default class StageScene extends Phaser.Scene {
  constructor() { super('Stage'); }

  init(data) {
    this.stage = data.stage || 1;
    this.step = data.step || 1;
    this.stepLabelBase = data.stepLabelBase || this.stage;
  }

  getStepLabel(step) {
    return `${this.stepLabelBase}-${step}`;
  }

  create() {
    const stageConfig = this.getStageConfig(this.stage, this.step);
    this.worldWidth = stageConfig.worldWidth;
    this.stageComplete = false;
    this.playerDead = false;
    this.loseSceneStarted = false;
    this.nextSceneStarted = false;
    this.transitioningOut = false;
    this.stageConfig = stageConfig;
    this.transientTimers = new Set();
    this.playerBurn = {
      active: false,
      ticksApplied: 0,
      nextTickAt: 0,
      endsAt: 0,
      tintUntil: 0,
      damagePerTick: 1,
      tickMs: 700,
      maxTicks: 3,
      durationMs: 2000
    };

    this.cameras.main.setBackgroundColor(stageConfig.skyColor);
    this.physics.world.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.roundPixels = true;

    if (this.stage !== 2) {
      const bgKey = this.stage === 1 ? 'stage1-bg' : 'game-background';
      const bgTexture = this.textures.get(bgKey).getSourceImage();
      const bgScale = 720 / bgTexture.height;
      const bg = this.add.tileSprite(this.worldWidth / 2, 360, this.worldWidth, 720, bgKey);
      bg.setTileScale(bgScale, bgScale).setDepth(-1000);
    } else {
      // 지하 연구소 그리드 배경
      const g = this.add.graphics();
      g.lineStyle(1, 0x1a2540, 0.35);
      for (let x = 0; x <= this.worldWidth; x += 200) g.lineBetween(x, 0, x, 720);
      for (let y = 0; y <= 720; y += 120) g.lineBetween(0, y, this.worldWidth, y);
      g.setDepth(-999);
    }

    // 지면 (피트 구간 지원)
    const groundGroup = this.physics.add.staticGroup();
    const groundTex = stageConfig.groundTexture || 'ground-tile';
    if (!stageConfig.noGround) {
      if (stageConfig.groundSegments) {
        stageConfig.groundSegments.forEach(seg => {
          const s = groundGroup.create(seg.x, 684, groundTex);
          s.setDisplaySize(seg.w, 68).refreshBody();
        });
      } else {
        const s = groundGroup.create(this.worldWidth / 2, 684, groundTex);
        s.setDisplaySize(this.worldWidth, 68).refreshBody();
      }
    }
    this.ground = groundGroup;

    // 플랫폼
    const platformGroup = this.physics.add.staticGroup();
    this.platformGroup = platformGroup;
    if (stageConfig.platforms) {
      const platTex = stageConfig.platformTexture || 'platform-tile';
      stageConfig.platforms.forEach(p => {
        const plat = platformGroup.create(p.x, p.y, platTex);
        plat.setDisplaySize(p.w, 24).refreshBody();
      });
    }

    const wallGroup = this.physics.add.staticGroup();
    this.wallGroup = wallGroup;
    if (stageConfig.verticalWalls) {
      stageConfig.verticalWalls.forEach(w => {
        const wall = wallGroup.create(w.x, w.y, 'lab-wall-tile');
        wall.setDisplaySize(w.w || 28, w.h || 180).refreshBody();
      });
    }

    // 천장 (W 공중 대시 차단 구간)
    const ceilingGroup = this.physics.add.staticGroup();
    this.ceilingGroup = ceilingGroup;
    if (stageConfig.ceilings) {
      stageConfig.ceilings.forEach(c => {
        const ceil = ceilingGroup.create(c.x, c.y, 'ceiling-tile');
        ceil.setDisplaySize(c.w, 20).refreshBody();
      });
    }

    const startX = stageConfig.startX || 140;
    const startY = stageConfig.startY || 520;
    this.player = new Player(this, startX, startY);
    this.physics.add.collider(this.player.sprite, this.ground);
    this.physics.add.collider(this.player.sprite, platformGroup);
    this.physics.add.collider(this.player.sprite, wallGroup);
    this.physics.add.collider(this.player.sprite, ceilingGroup);

    this.enemySprites = this.physics.add.group();
    const doraiMult = window.difficulty === 'dorai' ? 2 : 1;
    this.enemies = stageConfig.enemies.map(cfg => {
      const c = doraiMult > 1
        ? { ...cfg, damage: (cfg.damage || 1) * doraiMult, speed: (cfg.speed || 80) * doraiMult }
        : cfg;
      const enemy = new Enemy(this, c.x, c.y ?? 400, c);
      this.enemySprites.add(enemy.sprite);
      this.physics.add.collider(enemy.sprite, this.ground);
      this.physics.add.collider(enemy.sprite, platformGroup);
      this.physics.add.collider(enemy.sprite, wallGroup);
      return enemy;
    });

    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (!enemy) return;
      const now = this.time.now;
      if (now < this.player.dashingUntil && now >= (enemy._dashHitCooldown || 0)) {
        enemy._dashHitCooldown = now + 400;
        enemy.takeDamage(1);
      } else {
        enemy.tryAttack(this.player, now);
      }
    });

    // 함정 생성
    this.traps = [];
    this.createTraps(stageConfig);

    // 2-2 전용 요소는 stageConfig 플래그로만 활성화
    if (this.stage === 2 && this.step === 2 && stageConfig.movingObjects) {
      this.setupMovingObjects();
    }
    if (this.stage === 2) {
      this.add.text(this.worldWidth - 110, 510, 'EXIT ▶', {
        fontFamily: 'Arial', fontSize: '18px', color: '#7ef0c0', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(3);
    }

    this.stageText = this.add.text(24, 18, this.getStepLabel(this.step), {
      fontFamily: 'Arial', fontSize: '28px', color: '#f8e6b0'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial', fontSize: '20px', color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.helpText = this.add.text(24, 82, 'WASD 이동 | W 공중대시 | S 강하 | 좌클릭 공격 | Shift+방향 대시', {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
  }

  update(time, delta) {
    if (this.playerDead) {
      this.startLoseScene();
      return;
    }
    if (this.stageComplete) {
      this.startNextSceneAfterClear();
      return;
    }

    // Failsafe: 어떤 경로로든 사망 상태가 되면 즉시 게임오버 처리.
    if (!this.player.isAlive()) {
      this.handlePlayerDeath();
      return;
    }

    this.player.update(time, delta);
    this.enemies.forEach(e => e.update(time, delta, this.player));

    // 낙사 판정
    if (this.player.sprite.y > 740 && this.player.isAlive()) {
      this.killPlayerInstantly();
      return;
    }

    this.updateTraps(time);
    this.updatePlayerBurn(time);

    // 클리어 조건
    if (this.player.sprite.x >= this.worldWidth - 80) {
      this.handleStageClear();
      return;
    }

    if (this.stage !== 2) {
      // 적 전원 사망 = 클리어 (1-1 단계)
      if (this.enemies.length > 0 && this.enemies.every(e => !e.isAlive())) {
        this.handleStageClear();
      }
    }

    this.updateHUD();
  }

  setupMovingObjects() {
    const rnd = (min, max) => Math.random() * (max - min) + min;

    this.platformGroup.getChildren().forEach((s, index) => {
      const motion = s.motion || (index % 4 === 0 ? 'x' : index % 4 === 1 || index % 4 === 2 ? 'y' : 'x');
      const dir = Math.random() < 0.5 ? 1 : -1;
      const targetProps = motion === 'x'
        ? (() => {
            if (s.motionBounds) {
              const minX = s.motionBounds.minX ?? s.x - (s.motionRange || rnd(90, 170));
              const maxX = s.motionBounds.maxX ?? s.x + (s.motionRange || rnd(90, 170));
              return { x: Phaser.Math.Between(minX, maxX) };
            }
            const amp = s.motionRange || rnd(90, 170);
            return { x: s.x + amp * dir };
          })()
        : (() => {
            if (s.motionBounds) {
              const minY = s.motionBounds.minY ?? s.y - (s.motionRange || rnd(10, 18));
              const maxY = s.motionBounds.maxY ?? s.y + (s.motionRange || rnd(10, 18));
              return { y: Phaser.Math.Between(minY, maxY) };
            }
            const amp = s.motionRange || rnd(10, 18);
            return { y: s.y + amp * dir };
          })();

      this.tweens.add({
        targets: s,
        ...targetProps,
        duration: s.motionDuration || rnd(motion === 'x' ? 1800 : 1400, motion === 'x' ? 4200 : 2600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: s.motionDelay || rnd(0, 1800),
        onUpdate: () => {
          if (s?.active && s.body) s.refreshBody();
        }
      });
    });

    this.wallGroup.getChildren().forEach(s => {
      const amp = s.motionRange || rnd(8, 16);
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.tweens.add({
        targets: s,
        y: s.y + amp * dir,
        duration: s.motionDuration || rnd(1400, 2600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: s.motionDelay || rnd(0, 1600),
        onUpdate: () => {
          if (s?.active && s.body) s.refreshBody();
        }
      });
    });
  }

  cleanupStage2TransientSystems() {
    if (this.transientTimers) {
      this.transientTimers.forEach(timer => timer?.remove(false));
      this.transientTimers.clear();
    }

    if (this.platformGroup) {
      this.tweens.killTweensOf(this.platformGroup.getChildren());
    }
    if (this.wallGroup) {
      this.tweens.killTweensOf(this.wallGroup.getChildren());
    }
  }

  scheduleTransient(delay, callback) {
    if (!this.time || this.transitioningOut) return null;

    let timer = null;
    timer = this.time.delayedCall(delay, () => {
      this.transientTimers?.delete(timer);
      if (this.transitioningOut || this.playerDead || this.stageComplete || !this.sys?.isActive()) {
        return;
      }
      callback();
    });

    this.transientTimers?.add(timer);
    return timer;
  }

  createTraps(stageConfig) {
    if (!stageConfig.traps) return;
    stageConfig.traps.forEach(t => {
      if (t.type === 'fire') {
        const sprite = this.add.image(t.x, t.y, 'trap-fire');
        const followPlatformIndex = Number.isInteger(t.followPlatformIndex) ? t.followPlatformIndex : null;
        const followOffsetY = t.followOffsetY ?? -14;
        let followSprite = null;
        if (followPlatformIndex !== null && this.platformGroup) {
          followSprite = this.platformGroup.getChildren()[followPlatformIndex] || null;
          if (followSprite) {
            sprite.setPosition(followSprite.x, followSprite.y + followOffsetY);
          }
        }

        sprite.setDisplaySize(t.w || 128, 24).setDepth(2);
        this.tweens.add({ targets: sprite, scaleY: 0.88, scaleX: 1.12, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.traps.push({
          type: 'fire',
          sprite,
          followSprite,
          followOffsetY,
          burnDurationMs: t.burnDurationMs || 2000,
          burnTickMs: t.burnTickMs || 700,
          burnDamage: t.burnDamage || 1,
          burnTicksMax: t.burnTicksMax || 3
        });
      } else if (t.type === 'saw') {
        const sprite = this.physics.add.image(t.x, t.y, 'trap-saw');
        sprite.setDisplaySize(40, 40).setDepth(2);
        sprite.setImmovable(true);
        sprite.body.allowGravity = false;
        this.physics.add.overlap(this.player.sprite, sprite, () => {
          if (this.playerDead || this.stageComplete || !this.player.isAlive()) return;
          this.player.takeDamage(2, this.time.now);
        });
        this.traps.push({ type: 'saw', sprite, rangeLeft: t.rangeLeft, rangeRight: t.rangeRight, speed: t.speed || 80, dir: 1 });
      } else if (t.type === 'spike') {
        const sprite = this.physics.add.staticImage(t.x, t.y, 'trap-spike');
        sprite.setDisplaySize(t.w || 128, 24).setDepth(2).refreshBody();
        const followPlatformIndex = Number.isInteger(t.followPlatformIndex) ? t.followPlatformIndex : null;
        const followOffsetY = t.followOffsetY ?? -18;
        let followSprite = null;
        if (followPlatformIndex !== null && this.platformGroup) {
          followSprite = this.platformGroup.getChildren()[followPlatformIndex] || null;
          if (followSprite) {
            sprite.setPosition(followSprite.x, followSprite.y + followOffsetY);
            sprite.refreshBody();
          }
        }
        const periodMs = t.periodMs || 3000;
        const activeMs = t.activeMs || 900;
        const phaseMs = t.phaseMs || 0;
        const timed = !!t.timed;
        if (timed) {
          sprite.setAlpha(0.3);
        }
        this.physics.add.overlap(this.player.sprite, sprite, () => {
          if (timed && !trap.active) return;
          this.killPlayerInstantly();
        });
        const trap = { type: 'spike', sprite, timed, periodMs, activeMs, phaseMs, active: !timed, followSprite, followOffsetY };
        this.traps.push(trap);
      }
    });
  }

  killPlayerInstantly() {
    if (!this.player || this.stageComplete || this.playerDead) return;
    if (!this.player.isAlive()) {
      this.handlePlayerDeath();
      return;
    }

    this.player.health = 0;
    if (this.player.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }
    this.player.defeat();
    this.handlePlayerDeath();
  }

  updateTraps(time) {
    this.traps.forEach(trap => {
      if (trap.type === 'fire') {
        if (trap.followSprite?.active) {
          trap.sprite.setPosition(trap.followSprite.x, trap.followSprite.y + trap.followOffsetY);
        }

        const inRangeX = Math.abs(this.player.sprite.x - trap.sprite.x) <= (trap.sprite.displayWidth * 0.5 + 8);
        const inRangeY = Math.abs(this.player.sprite.y - trap.sprite.y) <= 40;
        const touchingFire = inRangeX && inRangeY;

        if (touchingFire) {
          this.startPlayerBurn(time, trap);
        }
      } else if (trap.type === 'spike') {
        if (trap.followSprite?.active) {
          trap.sprite.setPosition(trap.followSprite.x, trap.followSprite.y + trap.followOffsetY);
          trap.sprite.refreshBody();
        }

        if (trap.timed) {
          const localTime = (time + trap.phaseMs) % trap.periodMs;
          const isActive = localTime < trap.activeMs;
          if (trap.active !== isActive) {
            trap.active = isActive;
            trap.sprite.setAlpha(isActive ? 1 : 0.3);
            if (trap.sprite.body) {
              trap.sprite.body.enable = isActive;
            }
          }
        }

        if (trap.timed && !trap.active) return;

        // Spike hitbox can be visually buried in ground; use a foot-level check as a failsafe.
        const playerBody = this.player?.sprite?.body;
        if (!playerBody) return;

        const halfW = trap.sprite.displayWidth * 0.5;
        const left = trap.sprite.x - halfW;
        const right = trap.sprite.x + halfW;
        const feetY = playerBody.bottom;
        const spikeTop = trap.sprite.getBounds().top;
        const spikeBottom = trap.sprite.getBounds().bottom;

        const withinX = this.player.sprite.x >= left && this.player.sprite.x <= right;
        const withinY = feetY >= spikeTop - 8 && feetY <= spikeBottom + 6;
        if (withinX && withinY) {
          this.killPlayerInstantly();
          return;
        }
      } else if (trap.type === 'saw') {
        trap.sprite.angle += 5;
        const { rangeLeft, rangeRight, speed } = trap;
        if (trap.sprite.x <= rangeLeft) trap.dir = 1;
        if (trap.sprite.x >= rangeRight) trap.dir = -1;
        trap.sprite.body.setVelocityX(speed * trap.dir);
      }
    });
  }

  startPlayerBurn(time, trap) {
    if (this.playerDead || this.stageComplete || !this.player?.isAlive()) return;
    if (this.playerBurn.active) return;

    this.playerBurn.active = true;
    this.playerBurn.ticksApplied = 0;
    this.playerBurn.nextTickAt = time;
    this.playerBurn.damagePerTick = trap.burnDamage || 1;
    this.playerBurn.tickMs = trap.burnTickMs || 700;
    this.playerBurn.maxTicks = trap.burnTicksMax || 3;
    this.playerBurn.durationMs = trap.burnDurationMs || 2000;
    this.playerBurn.endsAt = time + this.playerBurn.durationMs;
    this.playerBurn.tintUntil = time + 1000;

    if (this.player?.sprite?.active) {
      this.player.sprite.setTint(0xff7a7a);
    }
  }

  updatePlayerBurn(time) {
    if (!this.playerBurn.active || !this.player?.isAlive()) return;

    if (this.player?.sprite?.active && time < this.playerBurn.tintUntil) {
      this.player.sprite.setTint(0xff7a7a);
    }

    while (time >= this.playerBurn.nextTickAt && this.playerBurn.ticksApplied < this.playerBurn.maxTicks) {
      this.playerBurn.ticksApplied += 1;
      this.player.takeDamage(this.playerBurn.damagePerTick, time);
      this.playerBurn.nextTickAt += this.playerBurn.tickMs;
      if (!this.player.isAlive()) break;
    }

    const burnEnded =
      time >= this.playerBurn.endsAt ||
      this.playerBurn.ticksApplied >= this.playerBurn.maxTicks ||
      !this.player.isAlive();

    if (!burnEnded) return;

    this.playerBurn.active = false;
    if (this.player?.sprite?.active && this.player.isAlive() && time >= this.playerBurn.tintUntil) {
      this.player.sprite.clearTint();
    }
  }

  getStageConfig(stage, step = 1) {
    if (stage === 2) {
      const step2BasePlatforms = [
        { x: 220,  y: 590, w: 340, motion: 'y', motionBounds: { minY: 560, maxY: 620 }, motionDuration: 2400 },
        { x: 560,  y: 480, w: 320, motion: 'y', motionBounds: { minY: 420, maxY: 540 }, motionDuration: 2600 },
        { x: 930,  y: 350, w: 320, motion: 'y', motionBounds: { minY: 300, maxY: 400 }, motionDuration: 2800 },
        { x: 1320, y: 520, w: 360, motion: 'y', motionBounds: { minY: 480, maxY: 560 }, motionDuration: 2200 },
        { x: 1720, y: 380, w: 340, motion: 'y', motionBounds: { minY: 330, maxY: 430 }, motionDuration: 2700 },
        { x: 2080, y: 500, w: 330, motion: 'y', motionBounds: { minY: 450, maxY: 550 }, motionDuration: 2400 },
        { x: 2380, y: 600, w: 340, motion: 'y', motionBounds: { minY: 570, maxY: 620 }, motionDuration: 2500 }
      ];
      const step2Platforms = step2BasePlatforms.flatMap((p) => {
        const halfW = p.w / 2;
        const offsetX = p.w / 4;
        return [
          { ...p, x: p.x - offsetX, w: halfW },
          { ...p, x: p.x + offsetX, w: halfW }
        ];
      });
      const step2TileFires = step2Platforms
        .map((p, index) => ({ p, index }))
        .filter(({ index }) => index % 4 === 1)
        .map(({ p, index }) => ({
          type: 'fire',
          x: p.x,
          y: p.y - 14,
          w: Math.max(28, p.w - 10),
          burnDamage: 1,
          burnTicksMax: 3,
          burnDurationMs: 2000,
          burnTickMs: 700,
          followPlatformIndex: index,
          followOffsetY: -14
        }));

      const labSteps = [
        {
          worldWidth: 2500,
          skyColor: 0x0a1020,
          startX: 140,
          startY: 520,
          groundTexture: 'lab-ground-tile',
          stepLabelBase: 2,
          verticalWalls: [
            { x: 640, y: 570, w: 28, h: 160 },
            { x: 980, y: 550, w: 28, h: 200 },
            { x: 1480, y: 540, w: 28, h: 220 },
            { x: 1880, y: 560, w: 28, h: 180 }
          ],
          platforms: [
            { x: 340, y: 560, w: 180 },
            { x: 780, y: 500, w: 160 },
            { x: 1180, y: 440, w: 180 },
            { x: 1580, y: 390, w: 170 },
            { x: 2000, y: 470, w: 170 },
            { x: 2280, y: 420, w: 180 }
          ],
          traps: [
            { type: 'spike', x: 860, y: 676, w: 120 },
            { type: 'spike', x: 2140, y: 676, w: 150 }
          ],
          enemies: [
            { x: 560, y: 520, health: 2, damage: 1, speed: 76, attackCooldown: 900, detectionRadius: 860, textureKey: 'enemy-basic', type: 'basic' },
            { x: 1120, y: 520, health: 2, damage: 1, speed: 78, attackCooldown: 880, detectionRadius: 880, textureKey: 'enemy-basic', type: 'basic' },
            { x: 1700, y: 520, health: 3, damage: 1, speed: 82, attackCooldown: 860, detectionRadius: 900, textureKey: 'enemy-elite', type: 'elite' },
            { x: 2180, y: 520, health: 3, damage: 1, speed: 84, attackCooldown: 840, detectionRadius: 930, textureKey: 'enemy-basic', type: 'basic' }
          ]
        },
        {
          worldWidth: 2800,
          skyColor: 0x0c1326,
          startX: 140,
          startY: 520,
          noGround: true,
          movingObjects: true,
          stepLabelBase: 2,
          groundTexture: 'lab-ground-tile',
          platforms: step2Platforms,
          verticalWalls: [
            { x: 350,  y: 280, w: 28, h: 200, motionBounds: { minY: 270, maxY: 290 }, motionDuration: 2200 },
            { x: 530,  y: 380, w: 28, h: 180, motionBounds: { minY: 370, maxY: 390 }, motionDuration: 2400 },
            { x: 780,  y: 320, w: 28, h: 190, motionBounds: { minY: 310, maxY: 330 }, motionDuration: 2300 },
            { x: 1010, y: 420, w: 28, h: 170, motionBounds: { minY: 410, maxY: 430 }, motionDuration: 2250 },
            { x: 1280, y: 300, w: 28, h: 200, motionBounds: { minY: 290, maxY: 310 }, motionDuration: 2500 },
            { x: 1550, y: 400, w: 28, h: 180, motionBounds: { minY: 390, maxY: 410 }, motionDuration: 2350 },
            { x: 1860, y: 280, w: 28, h: 185, motionBounds: { minY: 270, maxY: 290 }, motionDuration: 2400 },
            { x: 2150, y: 380, w: 28, h: 175, motionBounds: { minY: 370, maxY: 390 }, motionDuration: 2300 }
          ],
          traps: [
            ...step2TileFires,
            ...Array.from({ length: Math.ceil(2800 / 64) }, (_, index) => ({
              type: 'spike',
              x: index * 64 + 32,
              y: 676,
              w: 64,
              timed: index % 4 === 1 || index % 4 === 2,
              periodMs: 3000,
              activeMs: 900,
              phaseMs: (index % 4) * 450
            }))
          ],
          enemies: [
            { x: 520,  y: 520, health: 2, damage: 1, speed: 78, attackCooldown: 880, detectionRadius: 880, textureKey: 'enemy-basic', type: 'basic' },
            { x: 960,  y: 520, health: 2, damage: 1, speed: 80, attackCooldown: 860, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
            { x: 1420, y: 520, health: 3, damage: 1, speed: 82, attackCooldown: 850, detectionRadius: 920, textureKey: 'enemy-elite', type: 'elite' },
            { x: 1880, y: 520, health: 3, damage: 1, speed: 84, attackCooldown: 840, detectionRadius: 930, textureKey: 'enemy-basic', type: 'basic' },
            { x: 2340, y: 520, health: 3, damage: 1, speed: 86, attackCooldown: 830, detectionRadius: 940, textureKey: 'enemy-elite', type: 'elite' }
          ]
        },
        {
          worldWidth: 1600,
          skyColor: 0x0d1224,
          startX: 140,
          startY: 520,
          movingObjects: false,
          stepLabelBase: 2,
          groundTexture: 'lab-ground-tile',
          platforms: [
            { x: 340, y: 560, w: 200 },
            { x: 680, y: 480, w: 200 },
            { x: 1020, y: 400, w: 200 },
            { x: 1360, y: 480, w: 200 }
          ],
          verticalWalls: [],
          ceilings: [],
          traps: [
            { type: 'spike', x: 400, y: 676, w: 100 },
            { type: 'spike', x: 900, y: 676, w: 100 },
            { type: 'spike', x: 1400, y: 676, w: 100 }
          ],
          enemies: [
            { x: 600, y: 520, health: 2, damage: 1, speed: 80, attackCooldown: 860, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
            { x: 1100, y: 520, health: 3, damage: 1, speed: 82, attackCooldown: 850, detectionRadius: 920, textureKey: 'enemy-elite', type: 'elite' }
          ]
        },
        {
          worldWidth: 1451,
          skyColor: 0x0d1224,
          startX: 120,
          startY: 520,
          movingObjects: false,
          stepLabelBase: 2,
          groundTexture: 'lab-ground-tile',
          groundSegments: [
            { x: 120, w: 242 },
            { x: 362, w: 242 },
            { x: 604, w: 242 },
            { x: 846, w: 242 },
            { x: 1088, w: 242 },
            { x: 1330, w: 242 }
          ],
          platforms: [],
          verticalWalls: [],
          ceilings: [],
          traps: [],
          enemies: []
        }
      ];
      const selectedLabStep = labSteps[Math.min(step - 1, labSteps.length - 1)];
      if (window.difficulty === 'dorai') {
        return this.buildDoraiLabEscapeConfig(selectedLabStep, step);
      }
      return selectedLabStep;
    }

    // 1-1 단계: 숲 테마
    return {
      skyColor: 0x0b1a10,
      worldWidth: 4200,
      platformTexture: 'forest-platform-tile',
      platforms: [
        { x: 340,  y: 574, w: 210 },
        { x: 600,  y: 508, w: 160 },
        { x: 870,  y: 434, w: 230 },
        { x: 1150, y: 544, w: 175 },
        { x: 1420, y: 462, w: 210 },
        { x: 1700, y: 384, w: 170 },
        { x: 1960, y: 464, w: 190 },
        { x: 2240, y: 392, w: 200 },
        { x: 2530, y: 522, w: 170 },
        { x: 2800, y: 446, w: 220 },
        { x: 3080, y: 370, w: 175 },
        { x: 3370, y: 472, w: 200 },
        { x: 3650, y: 402, w: 185 },
        { x: 3940, y: 548, w: 210 },
      ],
      enemies: [
        { x: 600,  y: 370, health: 2, damage: 2, speed: 78,  attackCooldown: 880, detectionRadius: 880, textureKey: 'enemy-basic', type: 'basic' },
        { x: 980,  y: 360, health: 2, damage: 2, speed: 80,  attackCooldown: 870, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1420, y: 330, health: 2, damage: 2, speed: 82,  attackCooldown: 860, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1680, y: 300, health: 2, damage: 2, speed: 84,  attackCooldown: 850, detectionRadius: 920, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1960, y: 330, health: 2, damage: 2, speed: 80,  attackCooldown: 870, detectionRadius: 910, textureKey: 'enemy-basic', type: 'basic' },
        { x: 2350, y: 350, health: 3, damage: 2, speed: 85,  attackCooldown: 845, detectionRadius: 930, textureKey: 'enemy-basic', type: 'basic' },
        { x: 2800, y: 310, health: 3, damage: 2, speed: 86,  attackCooldown: 840, detectionRadius: 940, textureKey: 'enemy-basic', type: 'basic' },
        { x: 3320, y: 340, health: 3, damage: 2, speed: 88,  attackCooldown: 830, detectionRadius: 950, textureKey: 'enemy-basic', type: 'basic' },
        { x: 3650, y: 270, health: 3, damage: 2, speed: 90,  attackCooldown: 820, detectionRadius: 960, textureKey: 'enemy-basic', type: 'basic' },
        { x: 4100, y: 320, health: 3, damage: 2, speed: 92,  attackCooldown: 810, detectionRadius: 980, textureKey: 'enemy-basic', type: 'basic' },
      ]
    };
  }

  buildDoraiLabEscapeConfig(baseConfig, step) {
    const cloneArray = (arr) => Array.isArray(arr) ? arr.map(item => ({ ...item })) : arr;
    const config = {
      ...baseConfig,
      platforms: cloneArray(baseConfig.platforms),
      verticalWalls: cloneArray(baseConfig.verticalWalls),
      ceilings: cloneArray(baseConfig.ceilings),
      traps: cloneArray(baseConfig.traps),
      enemies: cloneArray(baseConfig.enemies),
      groundSegments: cloneArray(baseConfig.groundSegments)
    };

    if (step === 1 && Array.isArray(config.enemies) && config.enemies.length > 0) {
      const maxX = (config.worldWidth || 2500) - 120;
      const extraEnemies = config.enemies.map((enemy, index) => ({
        ...enemy,
        x: Math.min(maxX, enemy.x + 140 + (index % 2) * 40),
        speed: Math.round((enemy.speed || 80) * 1.03),
        attackCooldown: Math.max(700, (enemy.attackCooldown || 900) - 40)
      }));
      config.enemies = config.enemies.concat(extraEnemies);
    }

    if (step === 2 && Array.isArray(config.platforms) && Array.isArray(config.traps)) {
      const halfPlatformFires = config.platforms
        .map((p, index) => ({ p, index }))
        .filter(({ index }) => index % 2 === 1)
        .map(({ p, index }) => ({
          type: 'fire',
          x: p.x,
          y: p.y - 14,
          w: Math.max(28, p.w - 10),
          burnDamage: 1,
          burnTicksMax: 3,
          burnDurationMs: 2000,
          burnTickMs: 700,
          followPlatformIndex: index,
          followOffsetY: -14
        }));

      const nonFireTraps = config.traps.filter(t => t.type !== 'fire');
      config.traps = halfPlatformFires.concat(nonFireTraps);
    }

    if (Array.isArray(config.platforms)) {
      config.platforms = config.platforms.map(p => ({
        ...p,
        w: typeof p.w === 'number' ? Math.max(72, Math.round(p.w * 0.84)) : p.w,
        motionDuration: typeof p.motionDuration === 'number'
          ? Math.max(900, Math.round(p.motionDuration * 0.82))
          : p.motionDuration
      }));
    }

    if (Array.isArray(config.traps)) {
      config.traps = config.traps.map(t => {
        if (t.type === 'fire') {
          return {
            ...t,
            burnDamage: (t.burnDamage || 1) + 1,
            burnTickMs: Math.max(380, (t.burnTickMs || 700) - 180),
            burnTicksMax: (t.burnTicksMax || 3) + 1
          };
        }

        if (t.type === 'spike' && t.timed) {
          const periodMs = Math.max(1800, (t.periodMs || 3000) - 450);
          const activeMs = Math.min(periodMs - 250, (t.activeMs || 900) + 260);
          return {
            ...t,
            periodMs,
            activeMs
          };
        }

        if (t.type === 'saw') {
          return {
            ...t,
            speed: Math.round((t.speed || 80) * 1.3)
          };
        }

        return t;
      });
    }

    // 2-2 구간은 핵심 점프 파트라 DORAI에서만 추가 스파이크 라인을 더 깐다.
    if (step === 2 && Array.isArray(config.traps)) {
      const extraSpikes = [
        { type: 'spike', x: 448, y: 676, w: 96, timed: true, periodMs: 2400, activeMs: 1300, phaseMs: 200 },
        { type: 'spike', x: 1216, y: 676, w: 96, timed: true, periodMs: 2400, activeMs: 1300, phaseMs: 800 },
        { type: 'spike', x: 1984, y: 676, w: 96, timed: true, periodMs: 2400, activeMs: 1300, phaseMs: 1400 }
      ];
      config.traps = config.traps.concat(extraSpikes);
    }

    return config;
  }

  updateHUD() {
    const alive = this.enemies.filter(e => e.isAlive()).length;
    this.statusText.setText([
      `체력: ${this.player.health}/${this.player.maxHealth}`,
      this.stage === 2 ? `남은 적: ${alive}명 | 다음 구간으로 돌파` : `남은 적: ${alive}`
    ]);
  }

  handlePlayerDeath() {
    if (this.playerDead) return;
    this.playerDead = true;
    this.transitioningOut = true;

    this.cleanupStage2TransientSystems();

    // 충돌 콜백 내부 재진입을 피하기 위해 다음 틱에서 씬 전환.
    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }
    this.input.enabled = false;
    this.startLoseScene();
  }

  startLoseScene() {
    if (this.loseSceneStarted) return;
    this.loseSceneStarted = true;
    this.scene.start('End', { result: 'lose' });
  }

  handleStageClear() {
    if (this.stageComplete || this.playerDead) return;
    this.stageComplete = true;
    this.transitioningOut = true;

    this.cleanupStage2TransientSystems();

    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }
    this.input.enabled = false;
    this.startNextSceneAfterClear();
  }

  startNextSceneAfterClear() {
    if (this.nextSceneStarted) return;
    this.nextSceneStarted = true;

    if (this.stage === 1) {
      this.scene.start('Boss', { stage: 1, step: 2 });  // 1-2 단계
    } else if (this.stage === 2) {
      if (this.step < 3) {
        this.scene.start('Stage', {
          stage: 2,
          step: this.step + 1,
          stepLabelBase: 2
        });
      } else if (this.step === 3) {
        this.scene.start('Boss', { stage: 2, step: 3 });  // 2-3 단계
      } else {
        this.scene.start('End', { result: 'win' });
      }
    } else {
      this.scene.start('Stage', { stage: this.stage + 1 });
    }
  }
}
