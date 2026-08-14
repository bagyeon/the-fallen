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
    this.invincible = false;
    this.nextAttackAt = null;

    this.healthBarWidth = this.type === 'boss' ? 84 : 63;
    this.healthBarHeight = 6;
    this.healthBarOffsetY = this.type === 'boss' ? -90 : -72;

    this.sprite = scene.physics.add.sprite(x, y, this.textureKey);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(3);
    this.sprite.setScale(1.5);
    this.sprite.body.setSize(30, 40).setOffset(9, 14);
    this.sprite.enemyRef = this;

    this.healthBarBg = scene.add.rectangle(x - this.healthBarWidth / 2, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x1f2430, 0.9);
    this.healthBarBg.setOrigin(0, 0.5);
    this.healthBarBg.setDepth(6);
    if (this.type === 'boss' || this.type === 'boss2') this.healthBarBg.setVisible(false);

    this.healthBarFill = scene.add.rectangle(x - this.healthBarWidth / 2, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x66d37b, 1);
    this.healthBarFill.setOrigin(0, 0.5);
    this.healthBarFill.setDepth(7);
    if (this.type === 'boss' || this.type === 'boss2') this.healthBarFill.setVisible(false);

    this.rangeIndicator = scene.add.graphics();
    this.rangeIndicator.setDepth(1);
    this.rangeIndicator.setVisible(false);

    if (this.type === 'boss') {
      this.laserRangeGraphics = scene.add.graphics();
      this.laserRangeGraphics.setDepth(1);
    }

    if (this.type === 'boss') {
      this.sprite.setDisplaySize(219, 243);
      this.sprite.body.setSize(568, 689).setOffset(224, 227);
      this.bossActionCooldown = 0;
      this.bossNextActionAt = 0;
      this.bossLaserNextAt = 0;
      this.bossInAction = false;
      this.bossPhase = 1;
      this.damageReduction = 0;
      this.bossShielded = false;
      this.bossShieldActivated = false; // 방어막 한 번만 활성화
      this.summonedEnemies = [];
      this.maxHealthPhase1 = this.maxHealth;
      this.bossHasRecovered = false; // 체력 회복 한 번만 체크
    }

    if (this.type === 'boss2') {
      this.sprite.setDisplaySize(120, 150);
      this.sprite.body.setSize(90, 120);
      this.sprite.body.setAllowGravity(false);
    }

    this.syncHealthBar();
  }

  update(time, delta, player) {
    if (this.defeated || !this.sprite.active) {
      return;
    }

    // boss2는 BossScene이 직접 제어
    if (this.type === 'boss2') {
      this.syncHealthBar();
      return;
    }

    // 보스가 방어막 상태이면 움직이지 않음
    if (this.type === 'boss' && this.bossShielded) {
      this.sprite.setVelocityX(0);
      this.syncHealthBar();
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.sprite.x, player.sprite.y);
    const direction = player.sprite.x >= this.sprite.x ? 1 : -1;
    const speed = this.getCurrentSpeed();

    this.sprite.setFlipX(direction < 0);
    this.syncHealthBar();

    // 보스 레이저: 근접 사거리의 5배 안에 있을 때만 발동
    if (this.type === 'boss' && !this.bossShielded && time >= this.bossLaserNextAt) {
      const laserRange = this.attackRange * 5;
      if (distance <= laserRange) {
        let laserInterval;
        if (window.difficulty === 'dorai') {
          laserInterval = this.bossPhase === 2 ? 100 : 1000;
        } else {
          laserInterval = this.bossPhase === 2 ? 1900 : 3000;
        }
        this.bossLaserNextAt = time + laserInterval;
        this.bossLaserAttack(player, time);
      }
    }

    if (distance <= this.detectionRadius) {
      if (distance > this.attackRange) {
        this.sprite.setVelocityX(direction * speed);
        this.nextAttackAt = null;
        this.hideAttackIndicator();
      } else {
        this.sprite.setVelocityX(0);
        // 보스 특수 공격 로직
        if (this.type === 'boss' && time >= this.bossNextActionAt && !this.bossInAction) {
          this.executeBossAction(player, time);
        } else {
          this.updateAttackCycle(player, time);
        }
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
    this.sprite.setTint(0xffef9d);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.resetTint();
      }
    });

    // 보스는 즉시, 일반 몹은 0.2초 후 데미지
    if (this.type === 'boss') {
      player.takeDamage(this.damage, time);
    } else {
      this.scene.time.delayedCall(10, () => {
        if (!this.defeated && player.health > 0) {
          player.takeDamage(this.damage, this.scene.time.now);
        }
      });
    }
  }

  takeDamage(amount) {
    if (this.defeated) {
      return;
    }

    if (this.invincible) {
      this.sprite.setTint(0xffffff);
      this.scene.time.delayedCall(100, () => { if (this.sprite?.active && !this.defeated) this.resetTint(); });
      return;
    }

    // 보스 방어막 상태 체크
    if (this.type === 'boss' && this.bossShielded) {
      return;
    }

    const reduction = (this.type === 'boss' && this.damageReduction) ? this.damageReduction : 0;
    const actualAmount = Math.max(0, amount * (1 - reduction));
    const previousHealth = this.health;
    this.health = Math.max(0, this.health - actualAmount);
    this.sprite.setTint(0xff4d4d);
    this.scene.cameras.main.shake(55, 0.0035);
    
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
    
    this.updateHealthBarFill();
    this.scene.time.delayedCall(100, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.resetTint();
      }
    });

    // 보스 체력이 절반 이하가 되면 방어막 활성화 (한 번만)
    if (this.type === 'boss' && !this.bossShieldActivated && this.health <= this.maxHealth / 2) {
      this.bossShieldActivated = true;
      this.activateBossShield();
    }

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
    if (this.laserRangeGraphics) {
      this.laserRangeGraphics.destroy();
      this.laserRangeGraphics = null;
    }

    // 보스류는 스프라이트를 바로 제거하지 않음 (씬에서 디졸브 애니메이션 처리)
    if (this.type !== 'boss' && this.type !== 'boss2') {
      if (this.sprite && this.sprite.active) {
        this.sprite.destroy();
      }
    } else {
      // 보스 물리 비활성화
      if (this.sprite && this.sprite.body) {
        this.sprite.body.enable = false;
        this.sprite.setVelocity(0, 0);
      }
    }
  }

  syncHealthBar() {
    if (!this.sprite || !this.sprite.active) {
      return;
    }

    const barX = this.sprite.x - this.healthBarWidth / 2;
    const barY = this.sprite.y + this.healthBarOffsetY;
    this.healthBarBg.setPosition(barX, barY);
    this.healthBarFill.setPosition(barX, barY);
    this.updateHealthBarFill();

    if (this.type === 'boss' && this.laserRangeGraphics) {
      const lr = this.attackRange * 5;
      this.laserRangeGraphics.clear();
      this.laserRangeGraphics.lineStyle(1.5, 0x00cfff, 0.45);
      this.laserRangeGraphics.strokeCircle(this.sprite.x, this.sprite.y, lr);
    }
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

  executeBossAction(player, time) {
    if (this.bossInAction) {
      return;
    }

    this.bossInAction = true;
    this.nextAttackAt = null;
    this.hideAttackIndicator();

    let actionType;
    if (this.bossPhase === 2) {
      // 페이즈 2: 5가지 액션 (레이저-이동-공격-레이저-대시 패턴 반복)
      actionType = Math.floor(Math.random() * 5);
    } else {
      // 페이즈 1: 3가지 액션
      actionType = Math.floor(Math.random() * 3);
    }

    switch (actionType) {
      case 0:
        this.bossDashAttack(player, time);
        break;
      case 1:
        this.bossTeleportAttack(player, time);
        break;
      case 2:
        this.bossLaserAttack(player, time);
        break;
      case 3:
        // 페이즈 2 추가 액션: 레이저 한번 더
        this.bossLaserAttack(player, time);
        break;
      case 4:
        // 페이즈 2 추가 액션: 대시 한번 더
        this.bossDashAttack(player, time);
        break;
    }

    // 페이즈 2에서는 스킬 텀을 더 짧게
    this.bossNextActionAt = time + (this.bossPhase === 2 ? 1000 : 3500);
  }

  bossDashAttack(player, time) {
    // 대시 공격 경고 표시 (0.5초 전)
    const direction = player.sprite.x >= this.sprite.x ? 1 : -1;
    const dashTargetX = this.sprite.x + (direction * 300);
    
    // 경고 범위 표시
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.lineStyle(3, 0xffab00, 0.8);
    warningGraphics.fillStyle(0xffab00, 0.2);
    warningGraphics.fillRect(dashTargetX - 60, this.sprite.y - 40, 120, 80);
    warningGraphics.strokeRect(dashTargetX - 60, this.sprite.y - 40, 120, 80);
    warningGraphics.setDepth(2);
    
    // 0.5초 후 경고 제거 및 실제 공격 실행
    this.scene.time.delayedCall(500, () => {
      warningGraphics.destroy();
      
      // 실제 돌진
      this.sprite.setVelocityX(direction * 450);
      this.sprite.setTint(0xffab00);
      
      // 돌진 완료 후 0.5초 딜레이로 공격 판정
      this.scene.time.delayedCall(500, () => {
        // 대시 도착 지점에서 데미지 판정
        if (Math.abs(player.sprite.x - dashTargetX) < 100) {
          player.takeDamage(this.damage, time);
        }
        
        this.sprite.setVelocityX(0);
        if (this.sprite && this.sprite.active && !this.defeated) {
          this.resetTint();
        }
        this.bossInAction = false;
      });
    });
  }

  bossTeleportAttack(player, time) {
    // 보스가 점프한 후 플레이어 위치로 텔레포트하며 공격
    const originalX = this.sprite.x;
    const originalY = this.sprite.y;
    
    this.sprite.setVelocityY(-400);
    this.sprite.setTint(0xa87fff);
    
    this.scene.time.delayedCall(300, () => {
      const teleportX = Phaser.Math.Clamp(
        player.sprite.x + (Math.random() > 0.5 ? 80 : -80),
        100,
        this.scene.worldWidth - 100
      );
      this.sprite.setPosition(teleportX, 500);
    });
    
    this.scene.time.delayedCall(400, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.resetTint();
      }
      player.takeDamage(this.damage * 1.5, time);
      this.bossInAction = false;
    });
  }

  bossLaserAttack(player, time) {
    const baseAngle = Math.random() * Math.PI * 2;
    const laserDistance = 2000;
    const innerRadius = 90; // 보스 몸통 가장자리에서 시작
    const bx = this.sprite.x;
    const by = this.sprite.y;

    // 경고 레이저 표시
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.lineStyle(3, 0xffab00, 0.5);

    for (let i = 0; i < 4; i++) {
      const angle = baseAngle + (Math.PI / 2) * i;
      const startX = bx + Math.cos(angle) * innerRadius;
      const startY = by + Math.sin(angle) * innerRadius;
      const endX = bx + Math.cos(angle) * laserDistance;
      const endY = by + Math.sin(angle) * laserDistance;
      warningGraphics.lineBetween(startX, startY, endX, endY);
    }

    warningGraphics.setDepth(2);

    // 0.7초 후 경고 레이저 제거
    this.scene.time.delayedCall(700, () => {
      warningGraphics.destroy();

      this.sprite.setTint(0xff3366);

      // 피해 판정 먼저 계산
      const playerAngle = Phaser.Math.Angle.Between(bx, by, player.sprite.x, player.sprite.y);
      const distToPlayer = Phaser.Math.Distance.Between(bx, by, player.sprite.x, player.sprite.y);
      for (let i = 0; i < 4; i++) {
        const angle = baseAngle + (Math.PI / 2) * i;
        const angleDiff = Phaser.Math.Angle.Normalize(playerAngle - angle);
        if (Math.abs(angleDiff) < 0.2 && distToPlayer > innerRadius && distToPlayer < 2000) {
          player.takeDamage(2, time);
        }
      }

      // 빔을 짧은 시간 동안 늘려가며 발사 효과
      let progress = 0;
      const totalDuration = 180;
      const beamGraphics = this.scene.add.graphics();
      beamGraphics.setDepth(3);

      const beamTimer = this.scene.time.addEvent({
        delay: 16,
        repeat: Math.floor(totalDuration / 16),
        callback: () => {
          if (!beamGraphics.active) return;
          progress = Math.min(1, progress + 16 / totalDuration);
          beamGraphics.clear();
          for (let i = 0; i < 4; i++) {
            const angle = baseAngle + (Math.PI / 2) * i;
            const startX = bx + Math.cos(angle) * innerRadius;
            const startY = by + Math.sin(angle) * innerRadius;
            const endX = bx + Math.cos(angle) * (innerRadius + (laserDistance - innerRadius) * progress);
            const endY = by + Math.sin(angle) * (innerRadius + (laserDistance - innerRadius) * progress);
            // 외곽 글로우
            beamGraphics.lineStyle(28, 0xff1144, 0.12);
            beamGraphics.lineBetween(startX, startY, endX, endY);
            // 중간 글로우
            beamGraphics.lineStyle(14, 0xff3366, 0.35);
            beamGraphics.lineBetween(startX, startY, endX, endY);
            // 밝은 코어
            beamGraphics.lineStyle(4, 0xffffff, 0.95);
            beamGraphics.lineBetween(startX, startY, endX, endY);
          }
        }
      });

      this.scene.time.delayedCall(totalDuration + 120, () => {
        beamTimer.remove();
        beamGraphics.destroy();
      });
    });
    
    this.scene.time.delayedCall(1000, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.resetTint();
      }
      this.bossInAction = false;
    });
  }

  resetTint() {
    if (!this.sprite?.active) return;
    if (this.type === 'boss' && this.bossPhase === 2) {
      this.sprite.setTint(0xff6600);
    } else {
      this.sprite.clearTint();
    }
  }

  isAlive() {
    return !this.defeated;
  }

  activateBossShield() {
    // 보스가 방어막 상태로 진입
    this.bossShielded = true;
    this.sprite.setTint(0x2a2a2a); // 검은색으로 표시
    
    // 보스 체력을 4분의 1로 감소
    this.health = Math.max(1, Math.floor(this.maxHealth / 4));
    this.updateHealthBarFill();
    
    // 소환할 적들 - 하늘에서 떨어지도록 y좌표를 높게 설정 (6마리)
    if (this.scene.spawnWeakEnemy) {
      const spawnPositions = [
        { x: this.sprite.x - 300, y: 50 },
        { x: this.sprite.x - 150, y: 50 },
        { x: this.sprite.x, y: 50 },
        { x: this.sprite.x + 150, y: 50 },
        { x: this.sprite.x + 300, y: 50 },
        { x: this.sprite.x + 450, y: 50 }
      ];
      
      for (const pos of spawnPositions) {
        this.scene.spawnWeakEnemy(pos.x, pos.y);
      }
    }
  }

  onAllSummonedEnemiesDefeated() {
    // 소환된 적이 모두 죽으면 호출됨
    if (!this.bossShielded) {
      return;
    }
    
    this.enterBossPhase2();
  }

  enterBossPhase2() {
    // 페이즈 2로 한 번만 진입
    if (this.bossPhase === 2) {
      return;
    }
    
    this.bossPhase = 2;
    this.bossShielded = false;
    
    this.health = Math.min(this.maxHealth, this.health + Math.floor(this.maxHealth / 2));
    this.updateHealthBarFill();
    
    // 근접 공격을 더 자주하도록 쿨타임 단축
    this.attackCooldown = 400; // 기존 620에서 단축
    
    // 주황색으로 각성 연출 후 영구 적용
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(100, () => {
      if (!this.sprite?.active) return;
      this.sprite.setTint(0xff4400);
    });
    this.scene.time.delayedCall(300, () => {
      if (!this.sprite?.active) return;
      this.sprite.setTint(0xffffff);
    });
    this.scene.time.delayedCall(500, () => {
      if (!this.sprite?.active) return;
      this.sprite.setTint(0xff6600); // 2페이즈 주황색 영구 유지
    });
    
    // 보스 행동 타이머 초기화
    this.bossNextActionAt = this.scene.time.now + 1500;
  }
}
