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

    this.maxHealth = 6;
    this.health = this.maxHealth;
    this.invulnerableUntil = 0;

    this.healthBarWidth = 44;
    this.healthBarHeight = 6;
    this.healthBarOffsetX = 44;
    this.healthBarOffsetY = -26;

    this.healthBarBg = scene.add.rectangle(x - this.healthBarOffsetX, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x1f2430, 0.9);
    this.healthBarBg.setOrigin(1, 0.5);
    this.healthBarBg.setDepth(6);

    this.healthBarFill = scene.add.rectangle(x - this.healthBarOffsetX, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x6ee07b, 1);
    this.healthBarFill.setOrigin(1, 0.5);
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
    } else {
      body.setVelocityX(0);

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
    const barX = this.sprite.x - this.healthBarOffsetX;
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
          enemy.takeDamage(1);
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
    this.sprite.setVelocityX(this.dashDirection * this.dashSpeed);
  }

  takeDamage(amount, time = 0) {
    if (time < this.invulnerableUntil) {
      return;
    }

    this.invulnerableUntil = time + 500;
    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xff7a7a);
    this.healthBarFill.setFillStyle(this.health <= 2 ? 0xff6b6b : 0x6ee07b, 1);
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
