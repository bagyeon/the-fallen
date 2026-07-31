import Phaser from 'phaser';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player-melee');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(4);
    this.sprite.body.setSize(30, 42).setOffset(9, 18);

    this.weaponSprite = scene.add.image(x, y, 'weapon-melee');
    this.weaponSprite.setDepth(5);
    this.weaponSprite.setOrigin(0.2, 0.5);

    this.cursors = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dash: Phaser.Input.Keyboard.KeyCodes.Z
    });

    this.speed = 280;
    this.jumpVelocity = -540;
    this.facing = 1;
    this.meleeRange = 112;
    this.attackCooldownUntil = 0;

    this.dashSpeed = 860;
    this.dashDuration = 180;
    this.dashCooldown = 900;
    this.dashingUntil = 0;
    this.nextDashAt = 0;
    this.dashDirection = 1;

    this.afterimageInterval = 30; // ms
    this.nextAfterimageAt = 0;

    this.maxHealth = 6;
    this.health = this.maxHealth;
    this.invulnerableUntil = 0;

    this.healthBarWidth = 44;
    this.healthBarHeight = 6;
    this.healthBarOffsetY = -50;

    this.healthBarBg = scene.add.rectangle(x - this.healthBarWidth / 2, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x1f2430, 0.9);
    this.healthBarBg.setOrigin(0, 0.5);
    this.healthBarBg.setDepth(6);

    this.healthBarFill = scene.add.rectangle(x - this.healthBarWidth / 2, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x6ee07b, 1);
    this.healthBarFill.setOrigin(0, 0.5);
    this.healthBarFill.setDepth(7);

    this.pointerAttackHandler = () => {
      this.tryMeleeAttack(this.scene.time.now);
    };

    this.scene.input.on('pointerdown', this.pointerAttackHandler);
  }

  update(time, delta) {
    const body = this.sprite.body;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.dash) && time >= this.nextDashAt) {
      this.startDash(time);
    }

    if (time < this.dashingUntil) {
      body.setVelocityX(this.dashDirection * this.dashSpeed);
      // 대시 중 유지
      this.sprite.setTint(0x87ceeb);
      // 잔상 생성
      if (time >= this.nextAfterimageAt) {
        this.spawnAfterimage();
        this.nextAfterimageAt = time + this.afterimageInterval;
      }
    } else {
      body.setVelocityX(0);
      // 대시 종료 시 색 제거
      if (this.sprite.isTinted) {
        this.sprite.clearTint();
      }

      if (this.cursors.left.isDown) {
        body.setVelocityX(-this.speed);
        this.facing = -1;
      } else if (this.cursors.right.isDown) {
        body.setVelocityX(this.speed);
        this.facing = 1;
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && body.onFloor()) {
      body.setVelocityY(this.jumpVelocity);
    }

    this.syncVisuals();
    this.syncHealthBar();
  }

  syncVisuals() {
    const direction = this.facing >= 0 ? 1 : -1;
    this.sprite.setFlipX(direction < 0);
    this.weaponSprite.setFlipX(direction < 0);
    this.weaponSprite.setPosition(this.sprite.x + this.facing * 23, this.sprite.y + 4);
    this.syncHealthBar();
  }

  syncHealthBar() {
    const barX = this.sprite.x - this.healthBarWidth / 2;
    const barY = this.sprite.y + this.healthBarOffsetY;
    const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 0;

    this.healthBarBg.setPosition(barX, barY);
    this.healthBarFill.setPosition(barX, barY);
    this.healthBarFill.setSize(this.healthBarWidth * healthRatio, this.healthBarHeight);
  }

  tryMeleeAttack(time) {
    if (time < this.attackCooldownUntil) {
      return;
    }

    this.attackCooldownUntil = time + 280;
    this.meleeAttack();
  }

  meleeAttack() {
    const direction = this.facing >= 0 ? 1 : -1;
    const isDashing = this.scene.time.now < this.dashingUntil;
    const damage = isDashing ? 2 : 1;
    const hitbox = this.scene.add.rectangle(this.sprite.x + direction * 48, this.sprite.y - 2, this.meleeRange, 40, 0xf3e0b0, 0.35);
    this.scene.physics.add.existing(hitbox);
    hitbox.body.allowGravity = false;
    hitbox.body.setImmovable(true);
    const hitEnemies = new Set();

    if (this.scene.enemySprites) {
      this.scene.physics.add.overlap(hitbox, this.scene.enemySprites, (hit, enemySprite) => {
        const enemy = enemySprite.enemyRef;
        if (enemy && !hitEnemies.has(enemy)) {
          hitEnemies.add(enemy);
          enemy.takeDamage(damage);
        }
      });
    }

    this.scene.time.delayedCall(120, () => {
      if (hitbox && hitbox.destroy) {
        hitbox.destroy();
      }
    });
  }

  startDash(time) {
    this.dashingUntil = time + this.dashDuration;
    this.nextDashAt = time + this.dashCooldown;
    this.dashDirection = this.facing >= 0 ? 1 : -1;
    this.nextAfterimageAt = time;
    this.sprite.setVelocityX(this.dashDirection * this.dashSpeed);
    // 대시 중 하늘색으로 표시
    this.sprite.setTint(0x87ceeb);
  }

  spawnAfterimage() {
    const ghost = this.scene.add.image(
      this.sprite.x,
      this.sprite.y,
      this.sprite.texture.key
    );
    ghost.setFlipX(this.sprite.flipX);
    ghost.setAlpha(0.6);
    ghost.setTint(0x87ceeb);
    ghost.setDepth(3); // 플레이어(4)보다 뒤
    ghost.setScale(this.sprite.scaleX, this.sprite.scaleY);

    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 180,
      ease: 'Linear',
      onComplete: () => {
        ghost.destroy();
      }
    });
  }

  takeDamage(amount, time = 0) {
    if (time < this.invulnerableUntil) {
      return;
    }

    this.invulnerableUntil = time + 500;
    const previousHealth = this.health;
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xff7a7a);
    this.healthBarFill.setFillStyle(this.health <= 2 ? 0xff6b6b : 0x6ee07b, 1);
    
    // 체력바 흔들림 효과
    const originalBarX = this.healthBarFill.x;
    this.scene.tweens.add({
      targets: this.healthBarFill,
      x: originalBarX + 4,
      duration: 50,
      yoyo: true,
      repeat: 3
    });
    
    // 체력바 천천히 줄어드는 효과
    if (this.healthBarFill && this.maxHealth > 0) {
      const currentWidth = this.healthBarWidth * (previousHealth / this.maxHealth);
      const newWidth = this.healthBarWidth * (this.health / this.maxHealth);
      let animatingHealthBar = { width: currentWidth };
      this.scene.tweens.add({
        targets: animatingHealthBar,
        width: newWidth,
        duration: 400,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          if (this.healthBarFill && this.healthBarFill.active) {
            this.healthBarFill.setSize(animatingHealthBar.width, this.healthBarHeight);
          }
        }
      });
    }
    
    this.scene.time.delayedCall(120, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
    });

    if (this.health <= 0) {
      this.defeat();
    }
  }

  defeat() {
    this.sprite.setVelocity(0, 0);
    this.weaponSprite.setVisible(false);
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
    }
    if (this.healthBarFill) {
      this.healthBarFill.destroy();
    }
    this.scene.input.off('pointerdown', this.pointerAttackHandler);
    if (this.scene.handlePlayerDeath) {
      this.scene.handlePlayerDeath();
    }
  }

  isAlive() {
    return this.health > 0;
  }

  getStatusText() {
    return `근접 / HP ${this.health}/${this.maxHealth}`;
  }
}
