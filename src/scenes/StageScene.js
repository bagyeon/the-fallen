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

    this.cameras.main.setBackgroundColor(stageConfig.skyColor);
    this.physics.world.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.roundPixels = true;

    const bgKey = this.stage === 1 ? 'stage1-bg' : this.stage === 2 ? 'stage2-bg' : 'game-background';
    const bgTexture = this.textures.get(bgKey).getSourceImage();
    const bgScale = 720 / bgTexture.height;
    const background = this.add.tileSprite(this.worldWidth / 2, 360, this.worldWidth, 720, bgKey);
    background.setTileScale(bgScale, bgScale);
    background.setDepth(-1000);

    const ground = this.physics.add.staticImage(this.worldWidth / 2, 684, 'ground-tile');
    ground.setDisplaySize(this.worldWidth, 68);
    ground.refreshBody();
    this.ground = ground;

    // 플랫폼 생성 (스테이지별 텍스처 지원)
    const platformGroup = this.physics.add.staticGroup();
    this.platformGroup = platformGroup;
    if (stageConfig.platforms) {
      const platTex = stageConfig.platformTexture || 'platform-tile';
      stageConfig.platforms.forEach(p => {
        const plat = platformGroup.create(p.x, p.y, platTex);
        plat.setDisplaySize(p.w, 24);
        plat.refreshBody();
      });
    }

    this.player = new Player(this, 140, 520);
    this.physics.add.collider(this.player.sprite, ground);
    this.physics.add.collider(this.player.sprite, platformGroup);

    this.enemySprites = this.physics.add.group();
    this.wave2Triggered = false;
    this.wave2Spawned = false;
    // dorai: 적 대미지·속도 2배
    const doraiMult = window.difficulty === 'dorai' ? 2 : 1;
    this.enemies = stageConfig.enemies.map((enemyConfig) => {
      const cfg = doraiMult > 1
        ? { ...enemyConfig, damage: (enemyConfig.damage || 1) * doraiMult, speed: (enemyConfig.speed || 80) * doraiMult }
        : enemyConfig;
      const enemy = new Enemy(this, cfg.x, cfg.y ?? 400, cfg);
      this.enemySprites.add(enemy.sprite);
      this.physics.add.collider(enemy.sprite, ground);
      this.physics.add.collider(enemy.sprite, platformGroup);
      return enemy;
    });

    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (!enemy) return;
      const now = this.time.now;
      // 대시 충돌 데미지 (좌클릭 없이)
      if (now < this.player.dashingUntil && now >= (enemy._dashHitCooldown || 0)) {
        enemy._dashHitCooldown = now + 400;
        enemy.takeDamage(1);
      } else {
        enemy.tryAttack(this.player, now);
      }
    });

    this.stageText = this.add.text(24, 18, `STAGE ${this.stage}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f8e6b0'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.helpText = this.add.text(24, 82, 'WASD 이동 | W 공중대시 | S 강하 | 좌클릭 공격 | Z 대시', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
  }

  update(time, delta) {
    if (this.stageComplete || this.playerDead) {
      return;
    }

    this.player.update(time, delta);
    this.enemies.forEach((enemy) => enemy.update(time, delta, this.player));

    // 맵 오른쪽 끝 도달 시 다음 스테이지로 이동
    if (this.player.sprite.x >= this.worldWidth - 80) {
      this.handleStageClear();
      return;
    }

    if (this.enemies.every((enemy) => !enemy.isAlive())) {
      if (this.stage === 2 && !this.wave2Triggered) {
        this.triggerWave2();
      } else if (!this.wave2Triggered || this.wave2Spawned) {
        this.handleStageClear();
      }
    }

    this.updateHUD();
  }

  getStageConfig(stage) {
    if (stage === 2) {
      return {
        skyColor: 0x1a2436,
        worldWidth: 4200,
        enemies: [
        { x: 720,  health: 4, damage: 2, speed: 92,  attackCooldown: 820, detectionRadius: 980,  textureKey: 'enemy-elite', type: 'elite' },
          { x: 1500, health: 4, damage: 2, speed: 98,  attackCooldown: 780, detectionRadius: 1000, textureKey: 'enemy-elite', type: 'elite' },
          { x: 2440, health: 4, damage: 2, speed: 102, attackCooldown: 760, detectionRadius: 1020, textureKey: 'enemy-elite', type: 'elite' },
          { x: 3400, health: 4, damage: 2, speed: 108, attackCooldown: 740, detectionRadius: 1040, textureKey: 'enemy-elite', type: 'elite' }
        ]
      };
    }

    // Stage 1: 숲 테마 — 뿌리·가지·수풀을 따라 오르내리는 지형
    return {
      skyColor: 0x0b1a10,
      worldWidth: 4200,
      platformTexture: 'forest-platform-tile',
      platforms: [
        { x: 340,  y: 574, w: 210 }, // 낮은 뿌리 둔덕
        { x: 600,  y: 508, w: 160 }, // 작은 돌출 바위
        { x: 870,  y: 434, w: 230 }, // 굵은 나뭇가지
        { x: 1150, y: 544, w: 175 }, // 숲 바닥 웅덩이 옆
        { x: 1420, y: 462, w: 210 }, // 중간 가지
        { x: 1700, y: 384, w: 170 }, // 높은 가지 (수관)
        { x: 1960, y: 464, w: 190 }, // 완만한 내리막
        { x: 2240, y: 392, w: 200 }, // 다시 수관 높이
        { x: 2530, y: 522, w: 170 }, // 숲 바닥 착지
        { x: 2800, y: 446, w: 220 }, // 중간 가지
        { x: 3080, y: 370, w: 175 }, // 높은 수관
        { x: 3370, y: 472, w: 200 }, // 내리막 가지
        { x: 3650, y: 402, w: 185 }, // 막바지 높은 지점
        { x: 3940, y: 548, w: 210 }, // 출구 앞 낮은 바닥
      ],
      enemies: [
        { x: 600,  y: 370, health: 2, damage: 2, speed: 78,  attackCooldown: 880, detectionRadius: 880, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1420, y: 330, health: 2, damage: 2, speed: 82,  attackCooldown: 860, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1960, y: 330, health: 2, damage: 2, speed: 80,  attackCooldown: 870, detectionRadius: 910, textureKey: 'enemy-basic', type: 'basic' },
        { x: 2800, y: 310, health: 3, damage: 2, speed: 86,  attackCooldown: 840, detectionRadius: 940, textureKey: 'enemy-basic', type: 'basic' },
        { x: 3650, y: 270, health: 3, damage: 2, speed: 90,  attackCooldown: 820, detectionRadius: 960, textureKey: 'enemy-basic', type: 'basic' },
      ]
    };
  }

  updateHUD() {
    this.statusText.setText([
      `체력: ${this.player.health}/${this.player.maxHealth}`,
      `남은 적: ${this.enemies.filter((enemy) => enemy.isAlive()).length}`
    ]);
  }

  triggerWave2() {
    this.wave2Triggered = true;
    this.statusText.setText('\u2757 \uad74\uc6d5\uc5d0\uc11c \uc801\uc774 \ub098\ud0c0\ub09c\ub2e4!');

    this.time.delayedCall(1000, () => {
        const doraiMult = window.difficulty === 'dorai' ? 2 : 1;
        const wave2Config = { health: 4, damage: 2 * doraiMult, speed: 98 * doraiMult, attackCooldown: 780, detectionRadius: 1000, textureKey: 'enemy-elite', type: 'elite' };
      const camX = this.cameras.main.scrollX;
      const spawnXs = Array.from({ length: 10 }, (_, i) => camX + 80 + i * 120);

      spawnXs.forEach(spawnX => {
        const enemy = new Enemy(this, spawnX, -60, wave2Config);
        this.enemySprites.add(enemy.sprite);
        this.physics.add.collider(enemy.sprite, this.ground);
        this.physics.add.collider(enemy.sprite, this.platformGroup);
        this.enemies.push(enemy);
      });
      this.wave2Spawned = true;
    });
  }

  handlePlayerDeath() {
    if (this.playerDead) {
      return;
    }

    this.playerDead = true;
    this.time.delayedCall(500, () => {
      this.scene.start('End', { result: 'lose' });
    });
  }

  handleStageClear() {
    if (this.stageComplete || this.playerDead) {
      return;
    }

    this.stageComplete = true;

    // 플레이어 이동 및 입력 즉시 차단
    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }

    this.time.delayedCall(700, () => {
      if (this.stage >= 2) {
        this.scene.start('Boss');
      } else {
        this.scene.start('Stage', { stage: this.stage + 1 });
      }
    });
  }
}
