import Phaser from 'phaser';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player-melee');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(4);
    this.sprite.body.setSize(30, 42).setOffset(9, 18);

    this.weaponSprite = scene.add.image(x, y, 'weapon-sword');
    this.weaponSprite.setDepth(5);
    this.weaponSprite.setOrigin(0.35, 0.82);
    this.weaponSprite.setDisplaySize(52, 48);
    this.weaponSprite.setAngle(0);
    this.weaponPivotY = 0.82;

    this.cursors = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      dashRight: Phaser.Input.Keyboard.KeyCodes.Z,
      dashLeft: Phaser.Input.Keyboard.KeyCodes.C,
      spinRight: Phaser.Input.Keyboard.KeyCodes.E,
      spinLeft: Phaser.Input.Keyboard.KeyCodes.Q
    });

    this.speed = 280;
    this.jumpVelocity = -540;
    this.facing = 1;
    this.meleeRange = 112;
    this.attackCooldownUntil = 0;
    this.canAirDash = true;
    this.groundSmashCooldownUntil = 0;
    this.groundSmashActive = false;
    this.groundSmashSpeed = 1200;
    this.groundSmashRadius = 150;
    this.groundSmashDamage = 2;

    this.spinAttackActive = false;
    this.spinAttackCooldownUntil = 0;
    this.lastEKeyTime = 0;
    this.lastQKeyTime = 0;
    this.spinAttackRadius = 110;
    this.spinAttackDamage = 1;

    this.dashSpeed = 860;
    this.airDashSpeed = 760;
    this.dashDuration = 180;
    this.dashCooldown = 900;
    this.dashingUntil = 0;
    this.nextDashAt = 0;
    this.dashDirection = 1;

    this.afterimageInterval = 30; // ms
    this.nextAfterimageAt = 0;

    this.maxHealth = 10;
    this.health = this.maxHealth;
    this.invulnerableUntil = 0;

    this.regenTimer = scene.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => {
        if (this.health > 0 && this.health < this.maxHealth) {
          this.health = Math.min(this.maxHealth, this.health + 1);
          this.syncHealthBar();
        }
      }
    });

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
    const onFloor = body.onFloor();

    if (onFloor) {
      this.canAirDash = true;
    }

    if (this.groundSmashActive) {
      body.setVelocityX(0);
      body.setVelocityY(this.groundSmashSpeed);
      this.sprite.setTint(0xffc977);

      if (onFloor) {
        this.resolveGroundSmash(time);
      }
      this.syncVisuals();
      this.syncHealthBar();
      return;
    }

    // 공중 E/Q 더블탭 → 720도 회전 공격
    if (!onFloor && !this.spinAttackActive) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.spinRight)) {
        const gap = time - this.lastEKeyTime;
        if (gap > 50 && gap < 350 && time >= this.spinAttackCooldownUntil) {
          this.startSpinAttack(time, 1);
          this.lastEKeyTime = 0;
        } else {
          this.lastEKeyTime = time;
        }
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.spinLeft)) {
        const gap = time - this.lastQKeyTime;
        if (gap > 50 && gap < 350 && time >= this.spinAttackCooldownUntil) {
          this.startSpinAttack(time, -1);
          this.lastQKeyTime = 0;
        } else {
          this.lastQKeyTime = time;
        }
      }
    }

    if (this.spinAttackActive) {
      body.setVelocityX(0);
      body.setVelocityY(0);
      this.syncHealthBar();
      return;
    }

    if (time >= this.nextDashAt) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.dashRight)) {
        this.startDash(time, 1);
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.dashLeft)) {
        this.startDash(time, -1);
      }
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
      // 2단 점프(공중 상승 대시) 중 S 입력 → 빠른 낙하로 취소
      if (this.dashDirection === 0 && Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.dashingUntil = 0;
        body.setVelocityY(620);
        this.sprite.clearTint();
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

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      if (onFloor) {
        body.setVelocityY(this.jumpVelocity);
      } else if (this.canAirDash) {
        this.startAirDash(time);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.down) && !onFloor && !this.canAirDash) {
      if (time >= this.groundSmashCooldownUntil) {
        this.startGroundSmash(time);
      }
    }

    this.syncVisuals();
    this.syncHealthBar();
  }

  syncVisuals() {
    const direction = this.facing >= 0 ? 1 : -1;
    const weaponPivotX = direction > 0 ? 0.16 : 0.84;

    this.sprite.setFlipX(direction < 0);
    this.weaponSprite.setOrigin(weaponPivotX, this.weaponPivotY);
    this.weaponSprite.setFlipX(direction < 0);
    this.weaponSprite.setPosition(this.sprite.x + this.facing * 13, this.sprite.y - 4);
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
    const swingAngle = isDashing ? 90 : 150;
    const attackAngle = direction > 0 ? swingAngle : -swingAngle;

    this.syncVisuals();
    this.weaponSprite.setFlipX(direction < 0);
    this.weaponSprite.setAngle(attackAngle);
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

      if (this.weaponSprite && this.weaponSprite.active) {
        this.weaponSprite.setAngle(0);
      }
    });
  }

  startDash(time, direction = this.facing >= 0 ? 1 : -1) {
    this.dashingUntil = time + this.dashDuration;
    this.nextDashAt = time + this.dashCooldown;
    this.dashDirection = direction;
    this.nextAfterimageAt = time;
    this.sprite.setVelocityX(this.dashDirection * this.dashSpeed);
    // 대시 중 하늘색으로 표시
    this.sprite.setTint(0x87ceeb);
  }

  startAirDash(time) {
    this.canAirDash = false;
    this.dashingUntil = time + this.dashDuration;
    this.nextDashAt = time + this.dashCooldown;
    this.dashDirection = 0;
    this.nextAfterimageAt = time;
    this.sprite.setVelocityX(0);
    this.sprite.setVelocityY(-this.airDashSpeed);
    this.sprite.setTint(0x87ceeb);
  }

  startGroundSmash(time) {
    this.groundSmashActive = true;
    this.groundSmashCooldownUntil = time + 3000;
    this.dashingUntil = 0;
    this.sprite.setVelocityX(0);
    this.sprite.setVelocityY(this.groundSmashSpeed);
    this.sprite.setTint(0xffc977);
  }

  resolveGroundSmash(time) {
    this.groundSmashActive = false;
    this.sprite.setVelocityY(0);
    if (this.sprite.isTinted) {
      this.sprite.clearTint();
    }

    this.scene.cameras.main.shake(160, 0.006);

    const landingEffect = this.scene.add.circle(this.sprite.x, this.sprite.y + 18, 34, 0xffd08a, 0.35);
    landingEffect.setDepth(2);
    this.scene.tweens.add({
      targets: landingEffect,
      radius: this.groundSmashRadius,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        if (landingEffect && landingEffect.active) {
          landingEffect.setRadius(landingEffect.radius);
        }
      },
      onComplete: () => {
        landingEffect.destroy();
      }
    });

    if (!this.scene.enemySprites) {
      return;
    }

    const hitEnemies = [];
    this.scene.enemySprites.children.iterate((enemySprite) => {
      if (!enemySprite || !enemySprite.active) {
        return;
      }

      const enemy = enemySprite.enemyRef;
      if (!enemy || enemy.defeated) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, enemySprite.x, enemySprite.y);
      if (distance <= this.groundSmashRadius) {
        hitEnemies.push(enemySprite);
        enemy.takeDamage(this.groundSmashDamage, time);

        if (enemySprite.body) {
          const knockbackDirection = enemySprite.x >= this.sprite.x ? 1 : -1;
          enemySprite.body.setVelocityX(knockbackDirection * 320);
          enemySprite.body.setVelocityY(-180);
        }
      }
    });
  }

  startSpinAttack(time, direction) {
    this.spinAttackActive = true;
    this.spinAttackCooldownUntil = time + 2000;

    const hitSet1 = new Set();
    const hitSet2 = new Set();
    const radius = this.spinAttackRadius;
    const damage = this.spinAttackDamage;

    this.sprite.body.setVelocityX(0);
    this.sprite.body.setVelocityY(0);
    this.sprite.body.allowGravity = false;
    this.weaponSprite.setVisible(false);
    this.sprite.setTint(direction > 0 ? 0xff9944 : 0x44aaff);

    let hit1Done = false;
    const prog = { angle: 0 };
    const totalAngle = direction * 720;

    this.scene.tweens.add({
      targets: prog,
      angle: totalAngle,
      duration: 680,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.sprite.setAngle(prog.angle % 360);

        // 잔상 효과
        const now = this.scene.time.now;
        if (now >= (this._spinNextAfterimage || 0)) {
          this._spinNextAfterimage = now + 40;
          const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, this.sprite.texture.key);
          ghost.setAngle(this.sprite.angle);
          ghost.setFlipX(this.sprite.flipX);
          ghost.setAlpha(0.45);
          ghost.setTint(direction > 0 ? 0xff6622 : 0x2288ff);
          ghost.setDepth(3);
          this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 180, onComplete: () => ghost.destroy() });
        }

        // 1타: 360도 도달 시
        if (!hit1Done && Math.abs(prog.angle) >= 360) {
          hit1Done = true;
          this.checkSpinHits(hitSet1, radius, damage);
          this.scene.cameras.main.shake(70, 0.004);
        }
      },
      onComplete: () => {
        // 2타
        this.checkSpinHits(hitSet2, radius, damage);
        this.scene.cameras.main.shake(100, 0.005);

        this.sprite.setAngle(0);
        this.sprite.body.allowGravity = true;
        this.weaponSprite.setVisible(true);
        this.sprite.clearTint();
        this.spinAttackActive = false;
      }
    });
  }

  checkSpinHits(hitEnemies, radius, damage) {
    if (!this.scene.enemySprites) return;

    this.scene.enemySprites.children.iterate((enemySprite) => {
      if (!enemySprite || !enemySprite.active) return;
      const enemy = enemySprite.enemyRef;
      if (!enemy || enemy.defeated || hitEnemies.has(enemy)) return;

      const dist = Phaser.Math.Distance.Between(
        this.sprite.x, this.sprite.y,
        enemySprite.x, enemySprite.y
      );
      if (dist > radius) return;

      hitEnemies.add(enemy);
      enemy.takeDamage(damage);

      if (enemySprite.body) {
        const knockDir = enemySprite.x >= this.sprite.x ? 1 : -1;
        enemySprite.body.setVelocityX(knockDir * 320);
        enemySprite.body.setVelocityY(-160);
      }
    });
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
    if (this.regenTimer) {
      this.regenTimer.remove();
    }
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
