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
    this.ground = ground; // ground 저장

    this.player = new Player(this, 140, 520);
    this.physics.add.collider(this.player.sprite, ground);

    this.enemySprites = this.physics.add.group();
    this.summonedWeakEnemies = []; // 소환된 약한 적들 추적
    
    this.boss = new Enemy(this, this.worldWidth - 420, 500, {
      type: 'boss',
      health: 20,
      damage: 2,
      speed: 138,
      attackCooldown: 620,
      detectionRadius: 1600,
      attackRange: 60,
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

  spawnWeakEnemy(x, y) {
    // 1,2스테이지의 약한 적 생성 (체력 4배)
    const weakEnemy = new Enemy(this, x, y, {
      type: 'weak',
      health: 4,
      damage: 1,
      speed: 60,
      attackCooldown: 1500,
      detectionRadius: 600,
      attackRange: 60,
      textureKey: 'enemy-basic'
    });
    
    this.enemySprites.add(weakEnemy.sprite);
    this.physics.add.collider(weakEnemy.sprite, this.ground);
    
    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (enemy) {
        enemy.tryAttack(this.player, this.time.now);
      }
    });
    
    this.summonedWeakEnemies.push(weakEnemy);
    return weakEnemy;
  }

  update(time, delta) {
    if (this.ending) {
      return;
    }

    this.player.update(time, delta);
    this.boss.update(time, delta, this.player);

    // 소환된 약한 적들 업데이트 및 생존 확인
    this.summonedWeakEnemies = this.summonedWeakEnemies.filter(enemy => enemy && !enemy.defeated);
    
    for (const enemy of this.summonedWeakEnemies) {
      if (enemy && !enemy.defeated) {
        enemy.update(time, delta, this.player);
      }
    }
    
    // 소환된 적이 모두 죽었고 보스가 방어막 상태면 방어막 해제
    if (this.boss.bossShielded && this.summonedWeakEnemies.length === 0) {
      this.boss.onAllSummonedEnemiesDefeated();
    }

    if (!this.boss.isAlive()) {
      this.handleBossDefeat();
    }

    this.updateHUD();
  }
}
