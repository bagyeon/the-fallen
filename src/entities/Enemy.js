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

    this.healthBarFill = scene.add.rectangle(x - this.healthBarWidth / 2, y + this.healthBarOffsetY, this.healthBarWidth, this.healthBarHeight, 0x66d37b, 1);
    this.healthBarFill.setOrigin(0, 0.5);
    this.healthBarFill.setDepth(7);

    this.rangeIndicator = scene.add.graphics();
    this.rangeIndicator.setDepth(1);
    this.rangeIndicator.setVisible(false);

    if (this.type === 'boss') {
      this.laserRangeGraphics = scene.add.graphics();
      this.laserRangeGraphics.setDepth(1);
    }

    if (this.type === 'boss') {
      this.sprite.setScale(2.025);
      this.sprite.body.setSize(40, 54).setOffset(16, 18);
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

    this.syncHealthBar();
  }

  update(time, delta, player) {
    if (this.defeated || !this.sprite.active) {
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
        const laserInterval = this.bossPhase === 2 ? 900 : 2000;
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

    // 보스 방어막 상태 체크
    if (this.type === 'boss' && this.bossShielded) {
      return;
    }

    const reduction = (this.type === 'boss' && this.damageReduction) ? this.damageReduction : 0;
    const actualAmount = Math.max(1, Math.floor(amount * (1 - reduction)));
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
        this.sprite.clearTint();
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

    // 보스는 스프라이트를 바로 제거하지 않음 (씬에서 디졸브 애니메이션 처리)
    if (this.type !== 'boss') {
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
          this.sprite.clearTint();
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
        this.sprite.clearTint();
      }
      player.takeDamage(this.damage * 1.5, time);
      this.bossInAction = false;
    });
  }

  bossLaserAttack(player, time) {
    // 보스 중심에서 랜덤하게 주변으로 발사되는 레이저
    const baseAngle = Math.random() * Math.PI * 2;
    const laserDistance = 2000; // 충분히 긴 거리
    
    // 0.7초 전에 주황색 경고 레이저 표시
    const warningGraphics = this.scene.add.graphics();
    warningGraphics.lineStyle(3, 0xffab00, 0.5); // 주황색
    
    for (let i = 0; i < 4; i++) {
      const angle = baseAngle + (Math.PI / 2) * i;
      const endX = this.sprite.x + Math.cos(angle) * laserDistance;
      const endY = this.sprite.y + Math.sin(angle) * laserDistance;
      warningGraphics.lineBetween(this.sprite.x, this.sprite.y, endX, endY);
    }
    
    warningGraphics.setDepth(2);
    
    // 0.7초 후 경고 레이저 제거
    this.scene.time.delayedCall(700, () => {
      warningGraphics.destroy();
      
      this.sprite.setTint(0xff3366);
      
      // 십자형 레이저 발사 (보스 중심)
      const laserGraphics = this.scene.add.graphics();
      laserGraphics.lineStyle(6, 0xff3366, 0.9);
      
      // 같은 각도로 4개 방향 발사
      for (let i = 0; i < 4; i++) {
        const angle = baseAngle + (Math.PI / 2) * i;
        const endX = this.sprite.x + Math.cos(angle) * laserDistance;
        const endY = this.sprite.y + Math.sin(angle) * laserDistance;
        laserGraphics.lineBetween(this.sprite.x, this.sprite.y, endX, endY);
        
        // 플레이어가 레이저에 맞는지 확인 (보스 중심에서 발사되는 거리 기준)
        const distToPlayer = Phaser.Math.Distance.Between(
          this.sprite.x,
          this.sprite.y,
          player.sprite.x,
          player.sprite.y
        );
        
        // 레이저 방향과 플레이어 위치의 각도 비교
        const playerAngle = Phaser.Math.Angle.Between(
          this.sprite.x,
          this.sprite.y,
          player.sprite.x,
          player.sprite.y
        );
        
        // 각도 차이가 15도 이내면 맞음 (범위: 50px)
        const angleDiff = Phaser.Math.Angle.Normalize(playerAngle - angle);
        if (Math.abs(angleDiff) < 0.3 && distToPlayer < 150) {
          player.takeDamage(2, time);
        }
      }
      
      laserGraphics.setDepth(2);
      
      this.scene.time.delayedCall(300, () => {
        laserGraphics.destroy();
      });
    });
    
    this.scene.time.delayedCall(1000, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.sprite.clearTint();
      }
      this.bossInAction = false;
    });
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
    
    // 빨간색으로 표시하여 강화됨을 나타냄
    this.sprite.setTint(0xff6b6b);
    this.scene.time.delayedCall(500, () => {
      if (this.sprite && this.sprite.active && !this.defeated) {
        this.sprite.clearTint();
      }
    });
    
    // 보스 행동 타이머 초기화
    this.bossNextActionAt = this.scene.time.now + 1500;
  }
}
