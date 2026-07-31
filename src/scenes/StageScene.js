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

    const bgTexture = this.textures.get('game-background').getSourceImage();
    const bgScale = 720 / bgTexture.height;
    const background = this.add.tileSprite(this.worldWidth / 2, 360, this.worldWidth, 720, 'game-background');
    background.setTileScale(bgScale, bgScale);
    background.setDepth(-1000);

    const ground = this.physics.add.staticImage(this.worldWidth / 2, 684, 'ground-tile');
    ground.setDisplaySize(this.worldWidth, 68);
    ground.refreshBody();

    this.player = new Player(this, 140, 520);
    this.physics.add.collider(this.player.sprite, ground);

    this.enemySprites = this.physics.add.group();
    this.enemies = stageConfig.enemies.map((enemyConfig) => {
      const enemy = new Enemy(this, enemyConfig.x, 520, enemyConfig);
      this.enemySprites.add(enemy.sprite);
      this.physics.add.collider(enemy.sprite, ground);
      return enemy;
    });

    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (enemy) {
        enemy.tryAttack(this.player, this.time.now);
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

    if (this.enemies.every((enemy) => !enemy.isAlive())) {
      this.handleStageClear();
    }

    this.updateHUD();
  }

  getStageConfig(stage) {
    if (stage === 2) {
      return {
        skyColor: 0x1a2436,
        worldWidth: 4200,
        enemies: [
          { x: 720, health: 4, damage: 2, speed: 92, attackCooldown: 820, detectionRadius: 980, textureKey: 'enemy-elite', type: 'elite' },
          { x: 1500, health: 4, damage: 2, speed: 98, attackCooldown: 780, detectionRadius: 1000, textureKey: 'enemy-elite', type: 'elite' },
          { x: 2440, health: 4, damage: 2, speed: 102, attackCooldown: 760, detectionRadius: 1020, textureKey: 'enemy-elite', type: 'elite' },
          { x: 3400, health: 4, damage: 2, speed: 108, attackCooldown: 740, detectionRadius: 1040, textureKey: 'enemy-elite', type: 'elite' }
        ]
      };
    }

    return {
      skyColor: 0x223047,
      worldWidth: 3600,
      enemies: [
        { x: 760, health: 2, damage: 1, speed: 74, attackCooldown: 900, detectionRadius: 900, textureKey: 'enemy-basic', type: 'basic' },
        { x: 1620, health: 2, damage: 1, speed: 78, attackCooldown: 880, detectionRadius: 920, textureKey: 'enemy-basic', type: 'basic' },
        { x: 2580, health: 2, damage: 1, speed: 82, attackCooldown: 860, detectionRadius: 940, textureKey: 'enemy-basic', type: 'basic' }
      ]
    };
  }

  updateHUD() {
    this.statusText.setText([
      `체력: ${this.player.health}/${this.player.maxHealth}`,
      `남은 적: ${this.enemies.filter((enemy) => enemy.isAlive()).length}`
    ]);
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
