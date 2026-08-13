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
    this.stageConfig = stageConfig;

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

    if (this.stage === 2) {
      this.add.text(this.worldWidth - 110, 510, 'EXIT ▶', {
        fontFamily: 'Arial', fontSize: '18px', color: '#7ef0c0', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(3);
    }

    this.stageText = this.add.text(24, 18, this.getStepLabel(1), {
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
    if (this.stageComplete || this.playerDead) return;

    this.player.update(time, delta);
    this.enemies.forEach(e => e.update(time, delta, this.player));

    // 낙사 판정
    if (this.player.sprite.y > 740 && this.player.isAlive()) {
      this.player.health = 0;
      this.player.defeat();
      return;
    }

    this.updateTraps(time);

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

  createTraps(stageConfig) {
    if (!stageConfig.traps) return;
    stageConfig.traps.forEach(t => {
      if (t.type === 'fire') {
        const sprite = this.add.image(t.x, t.y, 'trap-fire');
        sprite.setDisplaySize(24, 36).setDepth(2);
        this.tweens.add({ targets: sprite, scaleY: 0.88, scaleX: 1.12, duration: 180, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.traps.push({ type: 'fire', sprite });
      } else if (t.type === 'saw') {
        const sprite = this.physics.add.image(t.x, t.y, 'trap-saw');
        sprite.setDisplaySize(40, 40).setDepth(2);
        sprite.setImmovable(true);
        sprite.body.allowGravity = false;
        this.physics.add.overlap(this.player.sprite, sprite, () => {
          this.player.takeDamage(2, this.time.now);
        });
        this.traps.push({ type: 'saw', sprite, rangeLeft: t.rangeLeft, rangeRight: t.rangeRight, speed: t.speed || 80, dir: 1 });
      } else if (t.type === 'spike') {
        const sprite = this.physics.add.staticImage(t.x, t.y, 'trap-spike');
        sprite.setDisplaySize(t.w || 128, 24).setDepth(2).refreshBody();
        this.physics.add.overlap(this.player.sprite, sprite, () => {
          if (this.player.isAlive()) { this.player.health = 0; this.player.defeat(); }
        });
        this.traps.push({ type: 'spike', sprite });
      } else if (t.type === 'laser') {
        const sprite = this.physics.add.staticImage(t.x, t.y, 'trap-laser');
        sprite.setDisplaySize(t.w || 128, t.h || 12).setDepth(2).refreshBody();
        this.physics.add.overlap(this.player.sprite, sprite, () => {
          if (this.player.isAlive()) { this.player.health = 0; this.player.defeat(); }
        });
        this.traps.push({ type: 'laser', sprite });
      }
    });
  }

  updateTraps(time) {
    this.traps.forEach(trap => {
      if (trap.type === 'fire') {
        const dist = Phaser.Math.Distance.Between(trap.sprite.x, trap.sprite.y - 10, this.player.sprite.x, this.player.sprite.y);
        if (dist < 38) this.player.takeDamage(1, time);
      } else if (trap.type === 'saw') {
        trap.sprite.angle += 5;
        const { rangeLeft, rangeRight, speed } = trap;
        if (trap.sprite.x <= rangeLeft) trap.dir = 1;
        if (trap.sprite.x >= rangeRight) trap.dir = -1;
        trap.sprite.body.setVelocityX(speed * trap.dir);
      }
    });
  }

  getStageConfig(stage, step = 1) {
    if (stage === 2) {
      const labSteps = [
        {
          worldWidth: 2500,
          skyColor: 0x0a1020,
          startX: 140,
          startY: 520,
          groundTexture: 'lab-ground-tile',
          stepLabelBase: 1,
          verticalWalls: [
            { x: 640, y: 510, w: 28, h: 160 },
            { x: 980, y: 420, w: 28, h: 200 },
            { x: 1480, y: 370, w: 28, h: 220 },
            { x: 1880, y: 430, w: 28, h: 180 }
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
            { type: 'laser', x: 1260, y: 260, w: 180, h: 10 },
            { type: 'laser', x: 1770, y: 220, w: 170, h: 10 },
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
          stepLabelBase: 1,
          platformTexture: 'lab-platform-tile',
          platforms: [
            { x: 180, y: 620, w: 210 },
            { x: 480, y: 560, w: 160 },
            { x: 760, y: 500, w: 150 },
            { x: 1020, y: 440, w: 150 },
            { x: 1290, y: 380, w: 150 },
            { x: 1580, y: 320, w: 150 },
            { x: 1880, y: 260, w: 160 },
            { x: 2180, y: 200, w: 170 },
            { x: 2480, y: 150, w: 170 }
          ],
          traps: [
            { type: 'spike', x: 990, y: 700, w: 240 },
            { type: 'spike', x: 1700, y: 700, w: 260 },
            { type: 'spike', x: 2400, y: 700, w: 280 }
          ],
          enemies: []
        }
      ];

      return labSteps[Math.min(step - 1, labSteps.length - 1)];
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
    this.time.delayedCall(500, () => this.scene.start('End', { result: 'lose' }));
  }

  handleStageClear() {
    if (this.stageComplete || this.playerDead) return;
    this.stageComplete = true;
    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }
    this.time.delayedCall(700, () => {
      if (this.stage === 1) {
        this.scene.start('Boss', { stage: 1 });  // 1-2 단계
      } else if (this.stage === 2) {
        if (this.step < 3) {
          this.scene.start('Stage', {
            stage: 2,
            step: this.step + 1,
            stepLabelBase: 1
          });
        } else {
          this.scene.start('End', { result: 'win' });
        }
      } else {
        this.scene.start('Stage', { stage: this.stage + 1 });
      }
    });
  }
}
