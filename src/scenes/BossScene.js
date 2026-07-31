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
    this.worldWidth = 1600;
    const bossHealthMultiplier = 1.8;

    this.bossMusic = this.sound.add('boss-bgm', { loop: false });
    this.bossMusic.on('complete', () => {
      if (!this.bossMusic) {
        return;
      }

      if (!this.ending && this.boss?.isAlive()) {
        this.bossMusic.play();
      } else {
        this.bossMusic.stop();
      }
    });
    this.bossMusic.play();

    this.events.once('shutdown', () => {
      if (this.bossMusic) {
        this.bossMusic.stop();
        this.bossMusic.destroy();
        this.bossMusic = null;
      }
    });

    this.cameras.main.setBackgroundColor(0x191225);
    this.physics.world.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.setBounds(0, 0, this.worldWidth, 720);
    this.cameras.main.roundPixels = true;

    const bgTexture = this.textures.get('boss-bg').getSourceImage();
    const bgScale = 720 / bgTexture.height;
    const background = this.add.tileSprite(this.worldWidth / 2, 360, this.worldWidth, 720, 'boss-bg');
    background.setTileScale(bgScale, bgScale);
    background.setDepth(-1000);

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
      health: Math.round(20 * bossHealthMultiplier),
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
      if (!enemy) return;
      const now = this.time.now;
      // 대시 충돌 데미지 (좌클릭 없이)
      if (now < this.player.dashingUntil && now >= (enemy._dashHitCooldown || 0)) {
        enemy._dashHitCooldown = now + 400;
        enemy.takeDamage(2);
      } else {
        enemy.tryAttack(this.player, now);
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

    // 보스 체력바 (화면 상단 중앙)
    const bossBarWidth = 400;
    const bossBarHeight = 22;
    const bossBarX = (this.scale.width - bossBarWidth) / 2;
    const bossBarY = 14;

    this.bossHpLabel = this.add.text(this.scale.width / 2, bossBarY - 2, 'BOSS', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#ff6688'
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1001);

    this.bossHpBarBg = this.add.rectangle(
      this.scale.width / 2, bossBarY + bossBarHeight / 2,
      bossBarWidth, bossBarHeight, 0x330011
    ).setScrollFactor(0).setDepth(1001);

    this.bossHpBarFill = this.add.rectangle(
      bossBarX, bossBarY + bossBarHeight / 2,
      bossBarWidth, bossBarHeight, 0xff3366
    ).setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);

    this.helpText = this.add.text(24, 82, 'WASD 이동 | W 공중대시 | S 강하 | 좌클릭 공격 | Z 대시', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
  }

  updateHUD() {
    this.statusText.setText([
      `체력: ${this.player.health}/${this.player.maxHealth}`
    ]);

    // 보스 체력바 갱신
    const ratio = Math.max(0, this.boss.health / this.boss.maxHealth);
    this.bossHpBarFill.setDisplaySize(400 * ratio, 22);
  }

  handleBossDefeat() {
    if (this.ending) {
      return;
    }

    this.ending = true;

    // 플레이어 이동 즉시 차단
    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }

    // 보스 스프라이트 위에서부터 픽셀이 사라지는 디졸브 애니메이션
    const bossSprite = this.boss.sprite;
    if (!bossSprite || !bossSprite.active) {
      this.time.delayedCall(500, () => {
        this.scene.start('End', { result: 'win' });
      });
      return;
    }

    // 보스 틴트 초기화
    bossSprite.clearTint();

    // setCrop을 이용해 위에서 아래로 픽셀이 사라지는 효과
    const frame = bossSprite.frame;
    const texW = frame.realWidth;
    const texH = frame.realHeight;
    const pixelStep = 3; // 픽셀 단위
    const dissolveData = { erasedRows: 0 };

    const updateCrop = () => {
      if (!bossSprite || !bossSprite.active) return;
      const cropY = dissolveData.erasedRows;
      const cropH = Math.max(0, texH - dissolveData.erasedRows);
      bossSprite.setCrop(0, cropY, texW, cropH);
    };

    updateCrop();

    const totalDuration = 1400;
    const steps = Math.ceil(texH / pixelStep);
    const stepInterval = totalDuration / steps;

    const dissolveTimer = this.time.addEvent({
      delay: stepInterval,
      repeat: steps,
      callback: () => {
        dissolveData.erasedRows = Math.min(dissolveData.erasedRows + pixelStep, texH + pixelStep);
        updateCrop();

        if (dissolveData.erasedRows >= texH) {
          dissolveTimer.remove();
          if (bossSprite.active) {
            bossSprite.destroy();
          }
          this.time.delayedCall(600, () => {
            this.scene.start('End', { result: 'win' });
          });
        }
      }
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
      if (!enemy) return;
      const now = this.time.now;
      if (now < this.player.dashingUntil && now >= (enemy._dashHitCooldown || 0)) {
        enemy._dashHitCooldown = now + 400;
        enemy.takeDamage(2);
      } else {
        enemy.tryAttack(this.player, now);
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
