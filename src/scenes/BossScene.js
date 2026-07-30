import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  handlePlayerDeath() {
    if (this.ending) {
      return;
    }

    this.ending = true;
    this.time.delayedCall(500, () => {
      this.scene.start('End', { result: 'lose' });
    });
  }

  create() {
    this.ending = false;
    this.worldWidth = 4800;

    this.cameras.main.setBackgroundColor(0x191225);
    this.physics.world.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.roundPixels = true;

    const ground = this.physics.add.staticImage(this.worldWidth / 2, 684, 'ground-tile');
    ground.setDisplaySize(this.worldWidth, 68);
    ground.refreshBody();

    this.player = new Player(this, 140, 520);
    this.physics.add.collider(this.player.sprite, ground);

    this.enemySprites = this.physics.add.group();
    this.boss = new Enemy(this, this.worldWidth - 420, 500, {
      type: 'boss',
      health: 20,
      damage: 2,
      speed: 92,
      attackCooldown: 620,
      detectionRadius: 1600,
      attackRange: 120,
      textureKey: 'boss'
    });
    this.enemySprites.add(this.boss.sprite);
    this.physics.add.collider(this.boss.sprite, ground);

    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (enemy) {
        enemy.tryAttack(this.player, this.time.now);
      }
    });

    this.titleText = this.add.text(24, 18, 'BOSS STAGE', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffd5a3'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.helpText = this.add.text(24, 82, 'WASD 이동 | 좌클릭 공격 | Z 대시', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
  }

  updateHUD() {
    this.statusText.setText([
      `체력: ${this.player.health}/${this.player.maxHealth}`,
      `보스 HP: ${this.boss.health}/${this.boss.maxHealth}`
    ]);
  }

  handleBossDefeat() {
    if (this.ending) {
      return;
    }

    this.ending = true;
    this.time.delayedCall(700, () => {
      this.scene.start('End', { result: 'win' });
    });
  }

  update(time, delta) {
    if (this.ending) {
      return;
    }

    this.player.update(time, delta);
    this.boss.update(time, delta, this.player);

    if (!this.boss.isAlive()) {
      this.handleBossDefeat();
    }

    this.updateHUD();
  }
}
