import Phaser from 'phaser';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player-melee');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(4);
    this.sprite.setDisplaySize(96, 96);
    this.sprite.body.setSize(480, 672).setOffset(272, 288);

    this.weaponSprite = scene.add.image(x, y, 'weapon-sword');
    this.weaponSprite.setDepth(5);
    this.weaponSprite.setOrigin(0.35, 0.82);
    this.weaponSprite.setDisplaySize(78, 72);
    this.weaponSprite.setAngle(0);
    this.weaponPivotY = 0.82;

    this.cursors = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
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
    this.spinAttackRadius = 160;
    this.spinAttackDamage = 1;

    this.dashSpeed = 860;
    this.airDashSpeed = 760;
    this.dashDuration = 180;
    this.dashCooldown = 500;
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

    this.healthBarWidth = 66;
    this.healthBarHeight = 6;
    this.healthBarOffsetY = -75;

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

    // 스킬 쿨다운 UI (화면 왼쪽 하단 고정)
    const skillDefs = [
      { label: 'DASH', sub: 'Shift+A/D', color: 0x3399ff },
      { label: 'Q/E',  sub: 'Spin',      color: 0xaa44ff },
      { label: 'S',    sub: 'Smash',     color: 0xff8822 },
    ];
    const boxW = 68, boxH = 58, gap = 8, startX = 20, startY = 650;
    this.skillSlots = skillDefs.map((def, i) => {
      const sx = startX + i * (boxW + gap);
      const bg = scene.add.rectangle(sx, startY, boxW, boxH, 0x080c14, 0.88).setOrigin(0, 0).setScrollFactor(0).setDepth(1010);
      const overlay = scene.add.rectangle(sx, startY, boxW, boxH, 0x000000, 0.65).setOrigin(0, 0).setScrollFactor(0).setDepth(1011);
      overlay.setSize(boxW, 0);
      const border = scene.add.rectangle(sx, startY, boxW, boxH, def.color, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(1012);
      border.setStrokeStyle(1.5, def.color, 0.7);
      const labelTxt = scene.add.text(sx + boxW / 2, startY + 8, def.label, { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#e8eeff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1013);
      const subTxt = scene.add.text(sx + boxW / 2, startY + 26, def.sub, { fontFamily: 'Arial', fontSize: '9px', color: '#778899' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1013);
      const timeTxt = scene.add.text(sx + boxW / 2, startY + 40, '', { fontFamily: 'Arial', fontSize: '12px', color: '#aaccff' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1013);
      return { overlay, timeTxt, boxH };
    });
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

    // 공중 E/Q 한 번 → 720도 회전 공격
    if (!onFloor && !this.spinAttackActive) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.spinRight) && time >= this.spinAttackCooldownUntil) {
        this.startSpinAttack(time, 1);
      }
      if (Phaser.Input.Keyboard.JustDown(this.cursors.spinLeft) && time >= this.spinAttackCooldownUntil) {
        this.startSpinAttack(time, -1);
      }
    }

    if (this.spinAttackActive) {
      body.setVelocityX(0);
      body.setVelocityY(0);
      this.syncHealthBar();
      return;
    }

    if (time >= this.nextDashAt) {
      const shiftJust = Phaser.Input.Keyboard.JustDown(this.cursors.shift);
      const rightJust = Phaser.Input.Keyboard.JustDown(this.cursors.right);
      const leftJust  = Phaser.Input.Keyboard.JustDown(this.cursors.left);
      if ((shiftJust && this.cursors.right.isDown) || (this.cursors.shift.isDown && rightJust)) {
        this.startDash(time, 1);
      } else if ((shiftJust && this.cursors.left.isDown) || (this.cursors.shift.isDown && leftJust)) {
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

      const dashReady = time >= this.nextDashAt;
      if (this.cursors.left.isDown && (!this.cursors.shift.isDown || !dashReady)) {
        body.setVelocityX(-this.speed);
        this.facing = -1;
      } else if (this.cursors.right.isDown && (!this.cursors.shift.isDown || !dashReady)) {
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
    this.syncCooldownUI(time);
  }

  syncCooldownUI(time) {
    if (!this.skillSlots) return;
    const cooldowns = [
      { until: this.nextDashAt,               total: this.dashCooldown },
      { until: this.spinAttackCooldownUntil,  total: 4000 },
      { until: this.groundSmashCooldownUntil, total: 3000 },
    ];
    cooldowns.forEach(({ until, total }, i) => {
      const slot = this.skillSlots[i];
      const remaining = Math.max(0, until - time);
      const ratio = Math.min(1, remaining / total);
      slot.overlay.setSize(slot.overlay.width, slot.boxH * ratio);
      slot.timeTxt.setText(remaining > 0 ? (remaining / 1000).toFixed(1) + 's' : '');
    });
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
    this.spinAttackCooldownUntil = time + 4000;

    // 5타 콤보: 720도를 144도 간격으로 나눔, 평타의 1.5배 데미지
    const hitSets = [new Set(), new Set(), new Set(), new Set(), new Set()];
    const radius = this.spinAttackRadius;
    const damage = this.spinAttackDamage * 0.75;
    const hitThresholds = [144, 288, 432, 576]; // 5번째는 onComplete 처리
    const hitsDone = [false, false, false, false];

    this.sprite.body.setVelocityX(0);
    this.sprite.body.setVelocityY(0);
    this.sprite.body.allowGravity = false;
    this.weaponSprite.setVisible(false);
    this.sprite.setTint(direction > 0 ? 0xff9944 : 0x44aaff);

    const prog = { angle: 0 };
    const totalAngle = direction * 720;

    this.scene.tweens.add({
      targets: prog,
      angle: totalAngle,
      duration: 780,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.sprite.setAngle(prog.angle % 360);

        const now = this.scene.time.now;
        // 검 잔상: 플레이어 주변 원호를 따라 검이 회전
        if (now >= (this._spinNextAfterimage || 0)) {
          this._spinNextAfterimage = now + 28;
          const angleRad = Phaser.Math.DegToRad(prog.angle - direction * 30);
          const trailR = 44;
          const wx = this.sprite.x + Math.cos(angleRad) * trailR;
          const wy = this.sprite.y + Math.sin(angleRad) * trailR;
          const swordGhost = this.scene.add.image(wx, wy, 'weapon-sword');
          swordGhost.setDisplaySize(52, 48);
          swordGhost.setOrigin(0.5, 0.8);
          swordGhost.setAngle(prog.angle + (direction > 0 ? 80 : -80));
          swordGhost.setAlpha(0.72);
          swordGhost.setTint(direction > 0 ? 0xff8833 : 0x33aaff);
          swordGhost.setDepth(5);
          this.scene.tweens.add({ targets: swordGhost, alpha: 0, scaleX: 0.7, scaleY: 0.7, duration: 140, onComplete: () => swordGhost.destroy() });
        }

        // 1~4타: 144도 간격마다 판정
        hitThresholds.forEach((threshold, i) => {
          if (!hitsDone[i] && Math.abs(prog.angle) >= threshold) {
            hitsDone[i] = true;
            this.checkSpinHits(hitSets[i], radius, damage);
            this.scene.cameras.main.shake(45, 0.003);
            this.spawnSlashFlash(direction, false);
          }
        });
      },
      onComplete: () => {
        // 5타 (마지막): 큰 슬래시 플래시
        this.checkSpinHits(hitSets[4], radius, damage);
        this.scene.cameras.main.shake(110, 0.006);
        this.spawnSlashFlash(direction, true);

        this.sprite.setAngle(0);
        this.sprite.body.allowGravity = true;
        this.weaponSprite.setVisible(true);
        this.sprite.clearTint();
        this.spinAttackActive = false;
      }
    });
  }

  spawnSlashFlash(direction, isFinal = false) {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(6);
    const cx = this.sprite.x;
    const cy = this.sprite.y;
    const r = this.spinAttackRadius * (isFinal ? 1.0 : 0.6);
    const color = direction > 0 ? 0xff9933 : 0x33bbff;
    const lineW = isFinal ? 3.5 : 2;
    gfx.lineStyle(lineW, color, isFinal ? 0.9 : 0.65);
    gfx.beginPath();
    gfx.arc(cx, cy, r, 0, Math.PI * 2);
    gfx.strokePath();
    if (isFinal) {
      gfx.lineStyle(1.5, 0xffffff, 0.6);
      gfx.beginPath();
      gfx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
      gfx.strokePath();
    }
    const expandScale = isFinal ? 1.4 : 1.25;
    this.scene.tweens.add({ targets: gfx, alpha: 0, scaleX: expandScale, scaleY: expandScale, duration: isFinal ? 280 : 160, ease: 'Quad.easeOut', onComplete: () => gfx.destroy() });
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
