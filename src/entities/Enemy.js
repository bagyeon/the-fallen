import Phaser from 'phaser';

export default class Enemy {
  constructor(scene, x, y, config = {}) {
    this.scene = scene;
    this.type = config.type || 'basic';
    this.maxHealth = config.health || 2;
    this.health = this.maxHealth;
    this.damage = config.damage || 1;
    this.speed = config.speed || 80;
    this.attackRange = config.attackRange || 72;
    this.attackCooldown = config.attackCooldown || 2000;
    this.attackWarningTime = config.attackWarningTime || 1000;
    this.detectionRadius = config.detectionRadius || 900;
    this.textureKey = config.textureKey || 'enemy-basic';
    this.defeated = false;
    this.nextAttackAt = null;

    this.healthBarWidth = this.type === 'boss' ? 56 : 42;
    this.healthBarHeight = 6;
    this.healthBarOffsetX = this.type === 'boss' ? 50 : 40;
    this.healthBarOffsetY = this.type === 'boss' ? -30 : -24;

    this.sprite = scene.physics.add.sprite(x, y, this.textureKey);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(3);
    this.sprite.body.setSize(30, 40).setOffset(9, 14);
    this.sprite.enemyRef = this;

    this.healthBarBg = scene.add.rectangle(x - this.healthBarOffsetX, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x1f2430, 0.9);
    this.healthBarBg.setOrigin(1, 0.5);
    this.healthBarBg.setDepth(6);

    this.healthBarFill = scene.add.rectangle(x - this.healthBarOffsetX, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x66d37b, 1);
    this.healthBarFill.setOrigin(1, 0.5);
    this.healthBarFill.setDepth(7);

    this.rangeIndicator = scene.add.graphics();
    this.rangeIndicator.setDepth(1);
    this.rangeIndicator.setVisible(false);

    if (this.type === 'boss') {
      this.sprite.setScale(1.35);
      this.sprite.body.setSize(40, 54).setOffset(16, 18);
    }

    this.syncHealthBar();
  }

  update(time, delta, player) {
    if (this.defeated || !this.sprite.active) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
    const direction = player.sprite.x >= this.sprite.x ? 1 : -1;
    const speed = this.getCurrentSpeed();

    this.sprite.setFlipX(direction < 0);
    this.syncHealthBar();

    if (distance <= this.detectionRadius) {
      if (distance > this.attackRange) {
        this.sprite.setVelocityX(direction * speed);
        this.nextAttackAt = null;
        this.hideAttackIndicator();
      } else {
        this.sprite.setVelocityX(0);
        this.updateAttackCycle(player, time);
      }
    } else {
      this.sprite.setVelocityX(0);
      this.nextAttackAt = null;
      this.hideAttackIndicator();
    }
  }

  getCurrentSpeed() {
    if (this.type === 'boss' && this.health <= this.maxHealth / 2) {
      return this.speed * 1.35;
    }

    return this.speed;
  }

  tryAttack(player, time) {
    this.updateAttackCycle(player, time);
  }

  updateAttackCycle(player, time) {
    if (this.nextAttackAt === null) {
      this.nextAttackAt = time + this.attackCooldown;
    }

    const warningStartsAt = this.nextAttackAt - this.attackWarningTime;
    if (time >= warningStartsAt && time < this.nextAttackAt) {
      this.showAttackIndicator();
    } else {
      this.hideAttackIndicator();
    }

    if (time < this.nextAttackAt) {
      return;
    }

    this.hideAttackIndicator();
    this.nextAttackAt = time + this.attackCooldown;
    player.takeDamage(this.damage, time);
    this.sprite.setTint(0xffef9d);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.sprite.clearTint();
      }
    });
  }

  takeDamage(amount) {
    if (this.defeated) {
      return;
    }

    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xff4d4d);
    this.updateHealthBarFill();
    this.scene.time.delayedCall(100, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.sprite.clearTint();
      }
    });

    if (this.health <= 0) {
      this.defeat();
    }
  }

  defeat() {
    if (this.defeated) {
      return;
    }

    this.defeated = true;
    if (this.healthBarBg) {
      this.healthBarBg.destroy();
    }
    if (this.healthBarFill) {
      this.healthBarFill.destroy();
    }
    if (this.rangeIndicator) {
      this.rangeIndicator.destroy();
    }
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }
  }

  syncHealthBar() {
    if (!this.sprite || !this.sprite.active) {
      return;
    }

    const barX = this.sprite.x - this.healthBarOffsetX;
    const barY = this.sprite.y + this.healthBarOffsetY;
    this.healthBarBg.setPosition(barX, barY);
    this.healthBarFill.setPosition(barX, barY);
    this.updateHealthBarFill();
  }

  updateHealthBarFill() {
    if (!this.healthBarFill) {
      return;
    }

    const healthRatio = this.maxHealth > 0 ? this.health / this.maxHealth : 0;
    this.healthBarFill.setSize(this.healthBarWidth * healthRatio, this.healthBarHeight);
    this.healthBarFill.setFillStyle(this.health <= 2 ? 0xff6b6b : 0x66d37b, 1);
  }

  showAttackIndicator() {
    if (!this.rangeIndicator || !this.sprite || !this.sprite.active) {
      return;
    }

    this.rangeIndicator.setVisible(true);
    this.rangeIndicator.clear();
    this.rangeIndicator.lineStyle(2, this.type === 'boss' ? 0xff8fb8 : 0xffa87a, 0.8);
    this.rangeIndicator.fillStyle(this.type === 'boss' ? 0xff6f9b : 0xff8d55, 0.14);
    this.rangeIndicator.strokeCircle(this.sprite.x, this.sprite.y - 6, this.attackRange);
    this.rangeIndicator.fillCircle(this.sprite.x, this.sprite.y - 6, this.attackRange);
  }

  hideAttackIndicator() {
    if (!this.rangeIndicator) {
      return;
    }

    this.rangeIndicator.clear();
    this.rangeIndicator.setVisible(false);
  }

  isAlive() {
    return !this.defeated;
  }
}
