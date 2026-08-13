import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  init(data) {
    this.stageIndex = data?.stage ?? 2;
  }

  getStepLabel(step) {
    return `${this.stageIndex}-${step}`;
  }

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

    this.bossMusic = this.sound.add('boss-bgm', { loop: false });
    this.bossMusic.on('complete', () => {
      if (!this.bossMusic) return;
      if (!this.ending && this.boss?.isAlive()) {
        this.bossMusic.play();
      } else {
        this.bossMusic.stop();
      }
    });
    this.bossMusic.play();
    this.events.once('shutdown', () => {
      if (this.bossMusic) { this.bossMusic.stop(); this.bossMusic.destroy(); this.bossMusic = null; }
    });

    if (this.stageIndex === 2) {
      this.createBoss2Arena();
      return;
    }

    // ─── 1-2 단계 보스 ─────────────────────────────────────────────────────
    this.worldWidth = 1600;
    const bossHealthMultiplier = 1.8;

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
      damage: 1,
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

    this.titleText = this.add.text(24, 18, this.getStepLabel(2), {
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
    if (!this.statusText) return;
    this.statusText.setText([`체력: ${this.player.health}/${this.player.maxHealth}`]);
    const ratio = Math.max(0, this.boss.health / this.boss.maxHealth);
    this.bossHpBarFill?.setDisplaySize(400 * ratio, 22);
  }

  handleBossDefeat() {
    if (this.ending) {
      return;
    }

    this.ending = true;

    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }

    // 기존 보스 스프라이트 디졸브 애니메이션
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
    if (this.ending) return;

    this.player.update(time, delta);

    if (this.stageIndex === 2) {
      // 2-2 단계 보스는 BossScene이 직접 제어
      if (this.player.sprite.y > 740 && this.player.isAlive()) {
        this.player.health = 0;
        this.player.defeat();
        return;
      }
      this.updateBoss2(time);
      if (!this.boss.isAlive()) this.handleBossDefeat();
      this.updateHUD();
      return;
    }

    this.boss.update(time, delta, this.player);
    this.summonedWeakEnemies = this.summonedWeakEnemies.filter(e => e && !e.defeated);
    for (const enemy of this.summonedWeakEnemies) {
      if (enemy && !enemy.defeated) enemy.update(time, delta, this.player);
    }
    if (this.boss.bossShielded && this.summonedWeakEnemies.length === 0) {
      this.boss.onAllSummonedEnemiesDefeated();
    }
    if (!this.boss.isAlive()) this.handleBossDefeat();
    this.updateHUD();
  }

  createBoss2Arena() {
    this.worldWidth = 1280;
    this.cameras.main.setBackgroundColor(0x0a0814);
    this.physics.world.setBounds(0, 0, 1280, 720);
    this.cameras.main.setBounds(0, 0, 1280, 720);
    this.cameras.main.roundPixels = true;

    // 어두운 그리드 배경
    const g = this.add.graphics();
    g.lineStyle(1, 0x1a1040, 0.5);
    for (let x = 0; x <= 1280; x += 160) g.lineBetween(x, 0, x, 720);
    for (let y = 0; y <= 720; y += 100) g.lineBetween(0, y, 1280, y);
    g.setDepth(-999);

    // 분할 지면 5개 세그먼트 (패턴으로 붕괴 가능)
    this.floorSegments = [];
    const segXs = [128, 384, 640, 896, 1152];
    const floorGroup = this.physics.add.staticGroup();
    segXs.forEach((sx, i) => {
      const seg = floorGroup.create(sx, 684, 'ground-tile');
      seg.setDisplaySize(248, 68).refreshBody();
      this.floorSegments.push({ sprite: seg, collapsed: false, index: i });
    });
    this.ground = floorGroup;

    // 플레이어
    this.player = new Player(this, 200, 500);
    this.floorSegments.forEach(fs => this.physics.add.collider(this.player.sprite, fs.sprite));

    // 보스 (1-2 단계 보스 스프라이트를 2-2 단계 아레나에서 사용)
    this.boss = new Enemy(this, 640, 180, {
      type: 'boss2',
      health: Math.round(24 * (window.difficulty === 'dorai' ? 2.5 : 1.3)),
      damage: 2, speed: 0, attackCooldown: 99999,
      detectionRadius: 0, attackRange: 0,
      textureKey: 'boss'
    });
    this.boss.sprite.body.allowGravity = false;
    this.boss.sprite.setPosition(640, 180);
    this.boss.sprite.setDisplaySize(219, 243);
    this.boss.sprite.body.setSize(568, 689).setOffset(224, 227);
    this.boss.sprite.setVelocity(0, 0);
    this.bossBaseScaleX = this.boss.sprite.scaleX;
    this.bossBaseScaleY = this.boss.sprite.scaleY;
    this.boss.invincible = true;

    // 투사체 그룹
    this.projectileGroup = this.physics.add.group();
    this.physics.add.overlap(this.player.sprite, this.projectileGroup, (_pl, proj) => {
      proj.destroy();
      this.player.takeDamage(1, this.time.now);
    });

    // 보스 접촉 데미지 (Vulnerable 중에만)
    this.enemySprites = this.physics.add.group();
    this.enemySprites.add(this.boss.sprite);
    this.summonedWeakEnemies = [];
    this.physics.add.overlap(this.enemySprites, this.player.sprite, (enemySprite) => {
      const enemy = enemySprite.enemyRef;
      if (!enemy || !enemy.isAlive()) return;
      const now = this.time.now;
      if (now < this.player.dashingUntil && now >= (enemy._dashHitCooldown || 0)) {
        enemy._dashHitCooldown = now + 400;
        if (!enemy.invincible) enemy.takeDamage(2);
      }
    });

    // 보스 Y 고정 (부유 없음)
    this.floatTween = null;

    // 패턴 상태 머신 초기화
    this.boss2State   = 'waiting';
    this.boss2PatIdx  = -1;
    this.boss2Ready   = false;  // delayedCall로 첫 패턴 지연
    this.boss2VulnerableUntil = 0;
    this.laserGraphic = null;
    this.laserGlow    = null;
    this.laserHitCooldown = 0;
    this.time.delayedCall(3000, () => { if (!this.ending) this.boss2Ready = true; });

    // HUD
    this.titleText = this.add.text(24, 18, this.getStepLabel(2), {
      fontFamily: 'Arial', fontSize: '28px', color: '#c080ff'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial', fontSize: '20px', color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.patternText = this.add.text(640, 58, '', {
      fontFamily: 'Arial', fontSize: '22px', color: '#ff4444', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    const bw = 400, bx = (1280 - bw) / 2, by = 14;
    this.bossHpLabel = this.add.text(640, by - 2, 'BOSS', {
      fontFamily: 'Arial', fontSize: '14px', color: '#c080ff'
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1001);
    this.bossHpBarBg = this.add.rectangle(640, by + 11, bw, 22, 0x1a0030)
      .setScrollFactor(0).setDepth(1001);
    this.bossHpBarFill = this.add.rectangle(bx, by + 11, bw, 22, 0xc080ff)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(1002);

    this.helpText = this.add.text(24, 82, 'WASD 이동 | W 공중대시 | S 강하 | 좌클릭 공격', {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
  }

  // ── 상태 머신 tick ────────────────────────────────────────────
  updateBoss2(time) {
    if (this.boss2State === 'waiting' && this.boss2Ready) {
      this.boss2Ready = false;
      this.startNextBoss2Pattern(time);
    }
    if (this.boss2State === 'vulnerable' && time >= this.boss2VulnerableUntil) {
      this.boss.invincible = true;
      this.killFloatTween();
      // 보스를 고정 Y 위치로 복귀
      this.boss.sprite.setPosition(640, 180);
      if (this.patternText) this.patternText.setText('');
      this.boss2State = 'waiting';
      this.time.delayedCall(1500, () => { if (!this.ending) this.boss2Ready = true; });
    }
    // 레이저 데미지 체크
    if (this.laserGraphic?.active) {
      const ly = this.laserGraphic.y;
      if (Math.abs(this.player.sprite.y - ly) < 28 && time >= this.laserHitCooldown) {
        this.laserHitCooldown = time + 380;
        this.player.takeDamage(1, time);
      }
    }
  }

  startNextBoss2Pattern(time) {
    if (this.ending) return;
    this.boss2PatIdx = (this.boss2PatIdx + 1) % 5;
    this.boss2State = 'pattern';
    this.boss.invincible = true;
    this.killFloatTween();
    switch (this.boss2PatIdx) {
      case 0: this.executeFloorCrumble(time); break;
      case 1: this.executeLaserSweep(time);   break;
      case 2: this.executeEggDive(time);      break;
      case 3: this.executeProjectileRain(time); break;
      case 4: this.executeTotalBlackout(time); break;
    }
  }

  openVulnerableWindow(duration, time) {
    if (this.ending) return;
    this.boss.invincible = false;
    this.boss2State = 'vulnerable';
    this.boss2VulnerableUntil = time + duration;
    this.tweens.add({
      targets: this.boss.sprite,
      scaleX: (this.bossBaseScaleX || this.boss.sprite.scaleX) * 1.05,
      scaleY: (this.bossBaseScaleY || this.boss.sprite.scaleY) * 1.05,
      duration: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
    if (this.patternText) {
      this.patternText.setText('▼ ATTACK NOW! ▼');
      this.patternText.setColor('#ff4444');
    }
  }

  killFloatTween() {
    if (this.floatTween) { this.floatTween.stop(); this.floatTween = null; }
    this.tweens.killTweensOf(this.boss.sprite);
    if (this.boss?.sprite) {
      this.boss.sprite.setScale(this.bossBaseScaleX || this.boss.sprite.scaleX, this.bossBaseScaleY || this.boss.sprite.scaleY);
    }
  }

  // ── 지면 붕괴 헬퍼 ────────────────────────────────────────────
  collapseFloorSegment(idx, autoRestore = true) {
    const fs = this.floorSegments[idx];
    if (!fs || fs.collapsed) return;
    fs.sprite.setTint(0xff3333);
    this.time.delayedCall(800, () => {
      if (this.ending) return;
      fs.collapsed = true;
      fs.sprite.setVisible(false);
      fs.sprite.body.enable = false;
      if (autoRestore) {
        this.time.delayedCall(2000, () => this.restoreFloorSegment(idx));
      }
    });
  }

  restoreFloorSegment(idx) {
    const fs = this.floorSegments[idx];
    if (!fs) return;
    fs.collapsed = false;
    fs.sprite.setVisible(true);
    fs.sprite.body.enable = true;
    fs.sprite.refreshBody();
    fs.sprite.clearTint();
    fs.sprite.setAlpha(1);
  }

  // ── 패턴 1: 지면 붕괴 ────────────────────────────────────────
  executeFloorCrumble(time) {
    if (this.patternText) { this.patternText.setText('FLOOR CRUMBLE!'); this.patternText.setColor('#ff8800'); }
    const indices = Phaser.Utils.Array.Shuffle([0,1,2,3,4]).slice(0,3);
    indices.forEach(i => this.collapseFloorSegment(i, true));
    // 붕괴 중 투사체 3발
    this.time.delayedCall(500, () => {
      for (let i = 0; i < 3; i++) {
        const p = this.projectileGroup.create(
          this.boss.sprite.x + (i-1)*50, this.boss.sprite.y + 80, 'boss2-projectile');
        p.setDisplaySize(14, 14).setDepth(6);
        p.body.allowGravity = false;
        p.setVelocityY(300);
        this.time.delayedCall(3000, () => { if (p.active) p.destroy(); });
      }
    });
    this.time.delayedCall(3800, () => { if (!this.ending) this.openVulnerableWindow(3000, this.time.now); });
  }

  // ── 패턴 2: 레이저 스윕 ──────────────────────────────────────
  executeLaserSweep(time) {
    if (this.patternText) { this.patternText.setText('LASER SWEEP!'); this.patternText.setColor('#ff2244'); }
    this.laserGraphic = this.add.rectangle(640, 175, 1280, 18, 0xff2244, 0.88);
    this.laserGraphic.setDepth(6);
    this.laserGlow = this.add.rectangle(640, 175, 1280, 36, 0xff2244, 0.2);
    this.laserGlow.setDepth(5);
    this.tweens.add({
      targets: [this.laserGraphic, this.laserGlow], y: 575, duration: 2800, ease: 'Linear',
      onComplete: () => {
        this.laserGraphic?.destroy(); this.laserGlow?.destroy();
        this.laserGraphic = null; this.laserGlow = null;
        if (!this.ending) this.openVulnerableWindow(3000, this.time.now);
      }
    });
  }

  // ── 패턴 3: 알 낙하 ──────────────────────────────────────────
  executeEggDive(time) {
    if (this.patternText) { this.patternText.setText('EGG DIVE!'); this.patternText.setColor('#ffaa00'); }
    const tx = Phaser.Math.Clamp(this.player.sprite.x, 80, 1200);
    // 경고 삼각형 마커
    const warn = this.add.triangle(tx, 640, 0, 32, 16, 0, 32, 32, 0xff2200, 0.9).setDepth(6);
    this.tweens.add({ targets: warn, alpha: 0.15, duration: 120, yoyo: true, repeat: 5,
      onComplete: () => warn.destroy() });
    // 보스 수평 이동 후 낙하
    this.tweens.add({ targets: this.boss.sprite, x: tx, duration: 500, ease: 'Quad.easeOut' });
    this.time.delayedCall(900, () => {
      if (this.ending) return;
      this.tweens.add({
        targets: this.boss.sprite, y: 540, duration: 280, ease: 'Quad.easeIn',
        onComplete: () => {
          this.cameras.main.shake(220, 0.012);
          // 충격파
          const sw = this.add.circle(this.boss.sprite.x, 596, 18, 0xff6600, 0.6).setDepth(5);
          this.tweens.add({ targets: sw, scaleX: 18, scaleY: 0.25, alpha: 0, duration: 420, onComplete: () => sw.destroy() });
          if (Math.abs(this.player.sprite.x - this.boss.sprite.x) < 260) {
            this.player.takeDamage(2, this.time.now);
          }
          // 착지 세그먼트 붕괴
          const nearSeg = this.floorSegments.findIndex(fs => Math.abs(fs.sprite.x - this.boss.sprite.x) < 130);
          if (nearSeg >= 0) this.collapseFloorSegment(nearSeg, true);
          // 위로 복귀
          this.tweens.add({
            targets: this.boss.sprite, y: 180, duration: 700, ease: 'Back.easeOut',
            onComplete: () => { if (!this.ending) this.openVulnerableWindow(3000, this.time.now); }
          });
        }
      });
    });
  }

  // ── 패턴 4: 투사체 산탄 ──────────────────────────────────────
  executeProjectileRain(time) {
    if (this.patternText) { this.patternText.setText('PROJECTILE RAIN!'); this.patternText.setColor('#60aaff'); }
    let wavesLeft = 3;
    const fireWave = () => {
      if (this.ending) return;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const p = this.projectileGroup.create(
          this.boss.sprite.x, this.boss.sprite.y, 'boss2-projectile');
        p.setDisplaySize(14, 14).setDepth(6);
        p.body.allowGravity = false;
        p.setVelocity(Math.cos(angle)*300, Math.sin(angle)*300);
        this.time.delayedCall(2800, () => { if (p.active) p.destroy(); });
      }
      this.tweens.add({ targets: this.boss.sprite, angle: this.boss.sprite.angle + 360, duration: 800, ease: 'Quad.easeOut' });
      wavesLeft--;
      if (wavesLeft > 0) this.time.delayedCall(1200, fireWave);
      else this.time.delayedCall(1400, () => { if (!this.ending) this.openVulnerableWindow(3000, this.time.now); });
    };
    this.time.delayedCall(400, fireWave);
  }

  // ── 패턴 5: 전면 붕괴 ────────────────────────────────────────
  executeTotalBlackout(time) {
    if (this.patternText) { this.patternText.setText('TOTAL BLACKOUT!'); this.patternText.setColor('#ff44ff'); }
    this.floorSegments.forEach(fs => fs.sprite.setTint(0xff4444));
    [0,1,2,3].forEach((idx, i) => {
      this.time.delayedCall(800 + i * 350, () => {
        const fs = this.floorSegments[idx];
        if (!fs || fs.collapsed || this.ending) return;
        fs.collapsed = true;
        fs.sprite.setVisible(false);
        fs.sprite.body.enable = false;
      });
    });
    this.time.delayedCall(800 + 3*350 + 2000, () => {
      if (this.ending) return;
      [0,1,2,3].forEach(i => this.restoreFloorSegment(i));
      this.time.delayedCall(500, () => { if (!this.ending) this.openVulnerableWindow(4000, this.time.now); });
    });
  }

}

