import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';

export default class StageScene extends Phaser.Scene {
  constructor() { super('Stage'); }

  init(data) { this.stage = data.stage || 1; }

  create() {
    const stageConfig = this.getStageConfig(this.stage);
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
    if (stageConfig.groundSegments) {
      stageConfig.groundSegments.forEach(seg => {
        const s = groundGroup.create(seg.x, 684, groundTex);
        s.setDisplaySize(seg.w, 68).refreshBody();
      });
    } else {
      const s = groundGroup.create(this.worldWidth / 2, 684, groundTex);
      s.setDisplaySize(this.worldWidth, 68).refreshBody();
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

    // Stage 2 출구 문
    if (this.stage === 2) {
      const door = this.add.image(this.worldWidth - 90, 584, 'door-tile');
      door.setDisplaySize(80, 120).setDepth(2);
      this.tweens.add({ targets: door, alpha: 0.65, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.text(this.worldWidth - 90, 510, 'BOSS ▶', {
        fontFamily: 'Arial', fontSize: '16px', color: '#00ff88', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(3);
    }

    this.stageText = this.add.text(24, 18, `STAGE ${this.stage}`, {
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
    if (this.stage === 2) {
      if (this.player.sprite.x >= this.worldWidth - 130) {
        this.handleStageClear();
        return;
      }
    } else {
      if (this.player.sprite.x >= this.worldWidth - 80) {
        this.handleStageClear();
        return;
      }
      // 적 전원 사망 = 클리어 (stage 1)
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

  getStageConfig(stage) {
    if (stage === 2) {
      return {
        skyColor: 0x0d1020,
        worldWidth: 5800,
        startX: 140, startY: 200,
        platformTexture: 'lab-platform-tile',
        groundTexture: 'lab-ground-tile',
        requireReachEnd: true,
        groundSegments: [],  // 바닥 없음 — 발판만으로 이동
        platforms: [
          // Zone 1: 고공 시작 → 내리막
          { x: 200,  y: 220, w: 220 },
          { x: 490,  y: 300, w: 180 },
          { x: 750,  y: 380, w: 160 },
          { x: 1010, y: 450, w: 180 },
          // Zone 2: 대시 필수 갭 (Shift+대시+점프)
          { x: 1060, y: 500, w: 180 },  // 오른쪽 끝 x≈1150 (피트 직전)
          { x: 1570, y: 440, w: 140 },  // 왼쪽 끝 x≈1500 (피트 직후) ← 갭 350px
          { x: 1800, y: 500, w: 180 },
          { x: 2020, y: 430, w: 160 },
          { x: 2200, y: 370, w: 160 },
          // Zone 3: 천장 함정 — W 공중 대시 사용 시 천장 충돌 후 낙사
          { x: 2290, y: 480, w: 200 },  // 오른쪽 끝 x≈2390
          { x: 2640, y: 440, w: 120 },  // 좁은 발판 (피트+천장 구간 내부)
          { x: 2920, y: 480, w: 200 },  // 피트2b 끝 x≈3020
          { x: 3200, y: 480, w: 200 },
          // Zone 4: 이동 톱날 + 피트3
          { x: 3420, y: 470, w: 180 },
          { x: 3620, y: 400, w: 160 },  // 오른쪽 끝 x≈3700 (피트3 직전)
          { x: 3850, y: 330, w: 140 },  // 피트3 위 공중 발판 (x 3780-3920)
          { x: 4080, y: 400, w: 160 },  // 왼쪽 끝 x≈4000 (피트3 직후) ← 갭 300px
          { x: 4300, y: 470, w: 180 },
          { x: 4500, y: 400, w: 160 },
          { x: 4680, y: 330, w: 140 },
          // Zone 5: 최종 돌진
          { x: 4870, y: 470, w: 180 },
          { x: 5080, y: 400, w: 160 },
          { x: 5290, y: 330, w: 150 },
          { x: 5480, y: 400, w: 160 },
          { x: 5680, y: 470, w: 180 },
        ],
        ceilings: [
          // Zone 3 천장: 이 구간에서 W 공중 대시 사용 시 천장에 막혀 낙사
          { x: 2640, y: 250, w: 500 },  // 피트2a (x 2310-2600) + 좁은 발판 위
          { x: 2960, y: 250, w: 400 },  // 피트2b (x 2820-3100) 위
        ],
        traps: [
          { type: 'fire',  x: 750,  y: 348 },
          { type: 'saw',   x: 2020, y: 398, rangeLeft: 1950, rangeRight: 2090, speed: 85 },
          { type: 'fire',  x: 2290, y: 448 },
          { type: 'fire',  x: 3200, y: 448 },
          { type: 'saw',   x: 3620, y: 368, rangeLeft: 3550, rangeRight: 3690, speed: 95 },
          { type: 'saw',   x: 4300, y: 438, rangeLeft: 4220, rangeRight: 4380, speed: 105 },
          { type: 'spike', x: 4680, y: 318, w: 128 },
          { type: 'fire',  x: 4870, y: 438 },
          { type: 'fire',  x: 5290, y: 298 },
          { type: 'saw',   x: 5080, y: 368, rangeLeft: 5010, rangeRight: 5150, speed: 115 },
          { type: 'spike', x: 5480, y: 388, w: 128 },
        ],
        enemies: [
          { x: 750,  y: 350, health: 4, damage: 2, speed: 92,  attackCooldown: 820, detectionRadius: 980,  textureKey: 'enemy-elite', type: 'elite' },
          { x: 1800, y: 470, health: 4, damage: 2, speed: 98,  attackCooldown: 780, detectionRadius: 1000, textureKey: 'enemy-elite', type: 'elite' },
          { x: 3420, y: 440, health: 4, damage: 2, speed: 102, attackCooldown: 760, detectionRadius: 1020, textureKey: 'enemy-elite', type: 'elite' },
          { x: 5290, y: 300, health: 4, damage: 2, speed: 108, attackCooldown: 740, detectionRadius: 1040, textureKey: 'enemy-elite', type: 'elite' },
        ]
      };
    }

    // Stage 1: 숲 테마
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
      this.stage === 2 ? `적: ${alive}명 (문까지 도달!)` : `남은 적: ${alive}`
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
        this.scene.start('Boss', { stage: 1 });  // Stage 1 → 기존 보스
      } else if (this.stage === 2) {
        this.scene.start('Boss', { stage: 2 });  // Stage 2 → 알 보스
      } else {
        this.scene.start('Stage', { stage: this.stage + 1 });
      }
    });
  }
}
