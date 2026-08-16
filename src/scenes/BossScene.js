import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import ScoreManager from '../managers/ScoreManager.js';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  init(data) {
    this.stageIndex = data?.stage ?? 2;
    this.stepIndex = data?.step ?? 2;
    this.score = data?.score ?? 0;
    ScoreManager.init();
  }

  addScore(attackType, enemyType) {
    let base = 0;
    if (attackType === 'basic') base = 100;
    else if (attackType === 'special') base = 200;
    else return;
    if (enemyType === 'boss' || enemyType === 'boss2') base += 50;
    this.score += base;
    if (this.scoreText && this.scoreText.active) {
      this.scoreText.setText(`점수: ${this.score}`);
    }
  }

  getStepLabel(step) {
    return `${this.stageIndex}-${step}`;
  }

  handlePlayerDeath() {
    if (this.ending) {
      return;
    }

    this.ending = true;
    this.endingResult = 'lose';
    this.deathTransitionAt = this.time.now;
    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }
    this.input.enabled = false;
    // 전환을 최우선으로 실행하고, 패턴 정리는 다음 틱에 안전하게 처리한다.
    this.startLoseScene();

    this.time.delayedCall(0, () => {
      if (!this.sys?.isActive()) return;
      try {
        this.shutdownBoss2PatternSystems();
      } catch (_) {
        // 사망 전환을 막지 않기 위해 정리 예외는 무시한다.
      }
    });

    this.time.delayedCall(50, () => {
      this.startLoseScene();
    });

    // Scene 타이머/업데이트가 멈춰도 작동하는 최종 폴백
    if (this.loseSceneFallbackTimer) {
      window.clearTimeout(this.loseSceneFallbackTimer);
      this.loseSceneFallbackTimer = null;
    }
    this.loseSceneFallbackTimer = window.setTimeout(() => {
      if (this.loseSceneStarted) return;
      this.forceStartLoseScene();
    }, 300);
  }

  startLoseScene() {
    if (this.loseSceneStarted) return;
    try {
      this.scene.start('End', {
        result: 'lose',
        score: this.score,
        stage: this.stageIndex,
        step: this.stepIndex
      });
      this.loseSceneStarted = true;
      if (this.loseSceneFallbackTimer) {
        window.clearTimeout(this.loseSceneFallbackTimer);
        this.loseSceneFallbackTimer = null;
      }
    } catch (_) {
      this.loseSceneStarted = false;
    }
  }

  forceStartLoseScene() {
    if (this.loseSceneStarted) return;
    try {
      this.scene.start('End', {
        result: 'lose',
        score: this.score,
        stage: this.stageIndex,
        step: this.stepIndex
      });
      this.loseSceneStarted = true;
    } catch (_) {
      try {
        const mgr = this.scene?.manager;
        if (mgr) {
          mgr.stop('Boss');
          mgr.start('End', {
            result: 'lose',
            score: this.score,
            stage: this.stageIndex,
            step: this.stepIndex
          });
          this.loseSceneStarted = true;
        }
      } catch (_) {
        this.loseSceneStarted = false;
      }
    }
  }

  create() {
    this.ending = false;
    this.endingResult = null;
    this.loseSceneStarted = false;
    this.deathTransitionAt = 0;
    this.loseSceneFallbackTimer = null;
    this.bossBattleSpeedMultiplier = window.difficulty === 'dorai' ? 2 : 1;
    this.bossBattleDelayScale = 1 / this.bossBattleSpeedMultiplier;
    this.bossLaserCountMultiplier = window.difficulty === 'dorai' ? 2 : 1;

    const bossTrackKey = this.stageIndex === 2 ? 'boss2-bgm' : 'boss1-bgm';
    this.bossMusic = this.sound.add(bossTrackKey, { loop: true });
    this.bossMusic.play({ loop: true });
    this.events.once('shutdown', () => {
      if (this.loseSceneFallbackTimer) {
        window.clearTimeout(this.loseSceneFallbackTimer);
        this.loseSceneFallbackTimer = null;
      }
      if (this.bossMusic) { this.bossMusic.stop(); this.bossMusic.destroy(); this.bossMusic = null; }
    });

    if (this.stageIndex === 2 && this.stepIndex === 3) {
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
      speed: Math.round(138 * this.bossBattleSpeedMultiplier),
      attackCooldown: Math.max(120, Math.round(620 * this.bossBattleDelayScale)),
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
        this.addScore('basic', enemy.type);
      } else {
        enemy.tryAttack(this.player, now);
      }
    });

    this.titleText = this.add.text(24, 18, this.getStepLabel(this.stepIndex), {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffd5a3'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.scoreText = this.add.text(this.scale.width - 24, 24, `점수: ${this.score}`, {
      fontFamily: 'Arial', fontSize: '28px', color: '#ffe08a', fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    // 보스 체력바 (화면 상단 중앙)
    const bossBarWidth = 400;
    const bossBarHeight = 22;
    const bossBarX = (this.scale.width - bossBarWidth) / 2;
    const bossBarY = 14;
    this.bossHpBarWidth = bossBarWidth;
    this.bossHpBarHeight = bossBarHeight;

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
    const lines = [`체력: ${this.player.health}/${this.player.maxHealth}`];
    if (this.stageIndex === 2 && this.stepIndex === 3 && this.boss) {
      lines.push(`보스 체력: ${Math.ceil(this.boss.health)}/${this.boss.maxHealth}`);
    }
    this.statusText.setText(lines);
    if (this.boss && this.bossHpBarFill && this.bossHpBarWidth && this.bossHpBarHeight) {
      const ratio = Math.max(0, this.boss.health / this.boss.maxHealth);
      this.bossHpBarFill?.setDisplaySize(this.bossHpBarWidth * ratio, this.bossHpBarHeight);
    }
  }

  handleBossDefeat() {
    if (this.ending) {
      return;
    }

    this.shutdownBoss2PatternSystems();
    this.ending = true;
    this.endingResult = 'win';

    if (this.player?.sprite?.body) {
      this.player.sprite.setVelocity(0, 0);
      this.player.sprite.body.enable = false;
    }

    // 기존 보스 스프라이트 디졸브 애니메이션
    const bossSprite = this.boss.sprite;
    if (!bossSprite || !bossSprite.active) {
      this.time.delayedCall(500, () => {
        this.scene.start('End', {
          result: 'win',
          score: this.score,
          stage: this.stageIndex,
          step: this.stepIndex
        });
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
            this.scene.start('End', {
              result: 'win',
              score: this.score,
              stage: this.stageIndex,
              step: this.stepIndex
            });
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
      speed: Math.round(60 * this.bossBattleSpeedMultiplier),
      attackCooldown: Math.max(220, Math.round(1500 * this.bossBattleDelayScale)),
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
        this.addScore('basic', enemy.type);
      } else {
        enemy.tryAttack(this.player, now);
      }
    });
    
    this.summonedWeakEnemies.push(weakEnemy);
    return weakEnemy;
  }

  update(time, delta) {
    // 승리/패배가 동시에 발생 가능한 프레임에서는 보스 처치를 우선한다.
    if (this.boss && !this.boss.isAlive()) {
      this.handleBossDefeat();
      return;
    }

    if (this.ending) {
      if (this.endingResult === 'lose') {
        // 전환이 누락된 경우를 위한 failsafe
        if (!this.loseSceneStarted && time >= (this.deathTransitionAt + 120)) {
          this.startLoseScene();
        }
        this.startLoseScene();
      }
      return;
    }

    // Failsafe: HP가 0 이하 상태면 즉시 패배 시퀀스 시작.
    if (!this.player.isAlive()) {
      this.handlePlayerDeath();
      return;
    }

    this.player.update(time, delta);

    if (this.stageIndex === 2 && this.stepIndex === 3) {
      this.updateBoss2(time);
      this.boss?.update(time, delta, this.player);

      // 보스가 죽었는지 먼저 체크 (플레이어 사망 체크 전)
      if (this.boss && !this.boss.isAlive()) {
        this.handleBossDefeat();
        return;
      }

      // 2-3 단계: 플레이어가 떨어지면 패배
      if (this.player.sprite.y > 740 && this.player.isAlive()) {
        this.player.health = 0;
        this.player.defeat();
        return;
      }
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

    // 타일 사이로 떨어졌을 때 닿으면 즉사하는 바닥
    this.deathFloor = this.physics.add.staticImage(this.worldWidth / 2, 732, 'ground-tile');
    this.deathFloor.setDisplaySize(this.worldWidth, 40).refreshBody();
    this.deathFloor.setAlpha(0);
    this.physics.add.overlap(this.player.sprite, this.deathFloor, () => {
      this.killPlayerFromBoss2Pattern();
    });

    // 전투 오브젝트
    this.enemySprites = this.physics.add.group();

    this.boss = new Enemy(this, 640, 180, {
      type: 'boss2',
      health: 23,
      damage: 1,
      speed: 0,
      attackCooldown: 999999,
      detectionRadius: 0,
      attackRange: 60,
      textureKey: 'boss2'
    });
    this.boss.sprite.setDisplaySize(300, 280);
    this.boss.sprite.setDepth(10);
    if (this.boss.sprite.body) {
      this.boss.sprite.body.setAllowGravity(false);
      this.boss.sprite.body.setImmovable(true);
      this.boss.sprite.body.setVelocity(0, 0);
    }
    this.setBoss2Hitbox(false);
    this.enemySprites.add(this.boss.sprite);

    // 보스2 패턴 상태
    this.boss2State = 'idle';
    this.boss2PatternStarted = false;
    this.boss2ActionLoopScheduled = false;
    this.boss2ActionRunning = false;
    this.boss2ActionIndex = 0;
    this.boss2ActionCount = 4;
    this.boss2Phase = 1;
    this.boss2Phase2Triggered = false;
    this.boss2PhaseTransitioning = false;
    this.boss2HalfHpAttackMultiplier = 1.5;
    this.boss2HalfHpSpeedBoostMs = 500;
    this.boss2ActionToken = 0;
    this.boss2PendingTimers = [];
    this.boss2CollapsedSegments = new Set();
    this.boss2LaserVisuals = [];
    this.boss2SpikeProjectiles = this.physics.add.group({
      allowGravity: false,
      immovable: true
    });
    this.boss2HomingMissiles = this.physics.add.group({
      allowGravity: false,
      immovable: false
    });
    this.physics.add.overlap(this.boss2SpikeProjectiles, this.player.sprite, (spikeObj) => {
      this.onBoss2SpikeOverlap(spikeObj);
    });
    this.physics.add.overlap(this.boss2HomingMissiles, this.player.sprite, (missileObj) => {
      this.onBoss2HomingMissileOverlap(missileObj);
    });
    this.boss2Pattern3Remaining = 0;
    this.boss2Pattern3Finished = false;
    this.boss2Pattern3ActionToken = 0;
    this.boss2Anchor = { x: this.boss.sprite.x, y: this.boss.sprite.y };
    this.boss2AnchorLocked = true;
    this.boss2MoveTween = null;
    this.boss2GlobalCrossLaserTimer = null;
    this.boss.invincible = true;

    this.boss2ShieldVisual = this.add.graphics();
    this.boss2ShieldVisual.setDepth(1190);

    // HUD
    this.titleText = this.add.text(24, 18, this.getStepLabel(this.stepIndex), {
      fontFamily: 'Arial', fontSize: '28px', color: '#c080ff'
    }).setScrollFactor(0).setDepth(1000);

    this.statusText = this.add.text(24, 54, '', {
      fontFamily: 'Arial', fontSize: '20px', color: '#edf3ff'
    }).setScrollFactor(0).setDepth(1000);

    this.scoreText = this.add.text(this.scale.width - 24, 24, `점수: ${this.score}`, {
      fontFamily: 'Arial', fontSize: '28px', color: '#ffe08a', fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    const bossBarWidth = 400;
    const bossBarHeight = 22;
    const bossBarX = (this.scale.width - bossBarWidth) / 2;
    const bossBarY = 14;
    this.bossHpBarWidth = bossBarWidth;
    this.bossHpBarHeight = bossBarHeight;

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

    this.patternText = this.add.text(this.scale.width / 2, 64, '패턴 준비중', {
      fontFamily: 'Arial', fontSize: '26px', color: '#ff8800', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(1000);

    this.patternText.setText('보스 무적: 패턴 진행중');
    this.patternText.setColor('#c9b6ff');

    this.helpText = this.add.text(24, 82, 'WASD 이동 | W 공중대시 | S 강하 | 좌클릭 공격', {
      fontFamily: 'Arial', fontSize: '16px', color: '#b9c9e8'
    }).setScrollFactor(0).setDepth(1000);

    this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    this.updateHUD();
    if (window.difficulty === 'dorai') {
      this.startBoss2GlobalCrossLaserLoop();
    }

    this.events.once('shutdown', () => {
      this.shutdownBoss2PatternSystems();
    });
  }

  queueBoss2Timer(delay, callback) {
    if (this.ending) return null;
    const scaledDelay = this.scaleBossBattleDelay(delay);
    const timer = this.time.delayedCall(scaledDelay, () => {
      this.boss2PendingTimers = this.boss2PendingTimers.filter(t => t !== timer);
      if (this.ending || !this.sys?.isActive()) return;
      callback();
    });
    this.boss2PendingTimers.push(timer);
    return timer;
  }

  scaleBossBattleDelay(baseMs) {
    return Math.max(1, Math.round(baseMs * (this.bossBattleDelayScale || 1)));
  }

  scaleBossBattleSpeed(baseSpeed) {
    return baseSpeed * (this.bossBattleSpeedMultiplier || 1);
  }

  clearBoss2Timers() {
    if (!this.boss2PendingTimers) return;
    this.boss2PendingTimers.forEach(timer => timer?.remove(false));
    this.boss2PendingTimers.length = 0;
  }

  startBoss2PatternLoop() {
    if (this.ending || this.boss2PhaseTransitioning || this.boss2ActionRunning || this.boss2PatternStarted || this.boss2ActionLoopScheduled) return;
    this.boss2PatternStarted = true;
    this.boss2ActionLoopScheduled = true;
    const startDelay = this.boss2Phase === 2 ? 700 : 1300;
    this.queueBoss2Timer(startDelay, () => {
      this.boss2ActionLoopScheduled = false;
      this.runNextBoss2Action();
    });
  }

  runNextBoss2Action() {
    if (this.ending || this.boss2PhaseTransitioning || this.boss2ActionRunning) return;
    this.boss2ActionRunning = true;
    this.boss2PatternStarted = true;
    this.boss2ActionLoopScheduled = false;

    const action = this.boss2ActionIndex % this.boss2ActionCount;
    this.boss2ActionIndex += 1;
    const actionToken = ++this.boss2ActionToken;
    this.boss.invincible = true;

    // 페이즈별 패턴 실행
    if (action === 0) {
      this.runBoss2FloorCollapseAction(actionToken, action);
      return;
    }

    if (action === 1) {
      this.runBoss2LaserAction(actionToken, action);
      return;
    }

    if (action === 2) {
      this.runBoss2SideSpikeAction(actionToken, action);
      return;
    }

    // 페이즈2에서만: 크로스 레이저 (action 3)
    if (action === 3) {
      if (this.boss2Phase >= 2) {
        this.runBoss2CrossLaserAction(actionToken, action);
        return;
      } else {
        // 페이즈1에서 action 3은 Vulnerable
        this.runBoss2VulnerableAction(actionToken, action);
        return;
      }
    }

    // 페이즈2에서만: Vulnerable (action 4)
    if (action === 4) {
      if (this.boss2Phase >= 2) {
        this.runBoss2VulnerableAction(actionToken, action);
        return;
      }
    }

    // 처리되지 않은 액션 (에러 로그용)
    console.error(`[Boss Pattern Error] Unhandled action: ${action}, phase: ${this.boss2Phase}, actionCount: ${this.boss2ActionCount}`);
    this.queueBoss2Timer(1800, () => this.runNextBoss2Action());
  }

  isBoss2ActionStale(actionToken) {
    return this.ending || !this.sys?.isActive() || actionToken !== this.boss2ActionToken;
  }

  finishBoss2Action(actionToken, action) {
    if (this.isBoss2ActionStale(actionToken)) return;
    if (this.boss2PhaseTransitioning) return;
    this.boss2ActionRunning = false;
    this.boss2State = 'idle';
    this.boss2PatternStarted = false;
    this.boss2ActionLoopScheduled = true;

    // 다음 패턴 시작 전까지 보스를 무적 상태로 설정
    if (this.boss) {
      this.boss.invincible = true;
    }

    if (this.patternText) {
      this.patternText.setText('다음 패턴');
      this.patternText.setColor('#99ddff');
    }
    this.queueBoss2Timer(900, () => {
      if (this.ending || this.boss2PhaseTransitioning) return;
      this.boss2ActionLoopScheduled = false;
      this.runNextBoss2Action();
    });
  }

  isBoss2HalfHpBuffActive() {
    if (!this.boss) return false;
    return this.boss.health <= this.boss.maxHealth * 0.5;
  }

  getBoss2ScaledDamage(baseDamage) {
    if (!this.isBoss2HalfHpBuffActive()) return baseDamage;
    return Math.max(1, Math.ceil(baseDamage * this.boss2HalfHpAttackMultiplier));
  }

  getBoss2FasterDelay(baseMs) {
    if (!this.isBoss2HalfHpBuffActive()) return baseMs;
    return Math.max(80, baseMs - this.boss2HalfHpSpeedBoostMs);
  }

  maybeTriggerBoss2Phase2() {
    if (!this.boss || !this.boss.isAlive()) return;
    if (this.boss2Phase2Triggered || this.boss2PhaseTransitioning) return;
    if (this.boss.health > this.boss.maxHealth * 0.5) return;

    this.boss2Phase2Triggered = true;
    this.boss2PhaseTransitioning = true;
    this.boss2ActionRunning = false;
    this.boss2PatternStarted = false;
    this.boss2State = 'phase2-transition';
    this.boss2ActionToken += 1;

    this.clearBoss2Timers();
    this.clearBoss2MoveTween();
    this.clearBoss2LaserVisuals();
    this.restoreCollapsedFloorSegments();
    this.clearBoss2SpikeProjectiles();
    this.clearBoss2HomingMissiles();

    this.boss.invincible = true;
    this.setBoss2Hitbox(false);
    this.boss2AnchorLocked = true;

    if (this.patternText) {
      this.patternText.setText('PHASE 2 돌입!');
      this.patternText.setColor('#ff5476');
    }

    this.cameras.main.shake(240, 0.004);
    if (this.boss?.sprite?.active) {
      this.boss.sprite.setTint(0xff5566);
    }

    this.queueBoss2Timer(350, () => {
      if (this.ending || !this.boss?.sprite?.active) return;
      this.boss.sprite.clearTint();
      this.boss.sprite.setTint(0xffb34d);
    });

    this.queueBoss2Timer(900, () => {
      if (this.ending || !this.boss?.sprite?.active) return;
      this.boss.sprite.clearTint();
    });

    this.queueBoss2Timer(1800, () => {
      if (this.ending || !this.boss?.isAlive()) return;

      this.boss2Phase = 2;
      this.boss2PhaseTransitioning = false;
      this.boss2ActionIndex = 0;
      this.boss2ActionCount = 5;

      if (this.patternText) {
        this.patternText.setText('PHASE 2: 패턴 강화');
        this.patternText.setColor('#ff7a5c');
      }
      this.startBoss2PatternLoop();
    });
  }

  runBoss2VulnerableAction(actionToken, action) {
    if (this.isBoss2ActionStale(actionToken)) return;
    this.boss2State = 'pattern4-vulnerable';
    this.boss.invincible = false;
    this.setBoss2Hitbox(true);
    const vulnerableDurationMs = this.boss2Phase >= 2 ? 3200 : 5000;
    this.clearBoss2MoveTween();
    this.boss2AnchorLocked = false;

    const anchorX = this.boss2Anchor?.x ?? this.boss?.sprite?.x ?? 640;
    const anchorY = this.boss2Anchor?.y ?? this.boss?.sprite?.y ?? 180;
    const dropY = 640;

    if (this.boss?.sprite?.active) {
      this.boss.sprite.setPosition(anchorX, anchorY);
      this.boss2MoveTween = this.tweens.add({
        targets: this.boss.sprite,
        y: dropY,
        duration: 420,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.boss2MoveTween = null;
        }
      });
    }

    if (this.patternText) {
      this.patternText.setText(this.boss2Phase >= 2 ? '패턴5: 3.2초 딜타임(하강)' : '패턴4: 5초 딜타임(하강)');
      this.patternText.setColor('#a8ffb3');
    }

    this.queueBoss2Timer(vulnerableDurationMs - 600, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      this.clearBoss2MoveTween();
      if (this.boss?.sprite?.active) {
        this.boss2MoveTween = this.tweens.add({
          targets: this.boss.sprite,
          x: anchorX,
          y: anchorY,
          duration: 450,
          ease: 'Quad.easeOut',
          onComplete: () => {
            this.boss2MoveTween = null;
          }
        });
      }
    });

    this.queueBoss2Timer(vulnerableDurationMs, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      this.clearBoss2MoveTween();
      if (this.boss?.sprite?.active) {
        this.boss.sprite.setPosition(anchorX, anchorY);
      }
      this.boss2AnchorLocked = true;
      this.boss.invincible = true;
      this.setBoss2Hitbox(false);
      this.finishBoss2Action(actionToken, action);
    });
  }

  setBoss2Hitbox(isVulnerable) {
    const body = this.boss?.sprite?.body;
    if (!body) return;

    // 딜타임에는 스프라이트 외형에 가깝게 넓혀서 "이미지를 때리면 맞는" 체감을 만든다.
    if (isVulnerable) {
      body.setSize(375, 345, true);
    } else {
      body.setSize(210, 255, true);
    }
  }

  clearBoss2MoveTween() {
    if (!this.boss2MoveTween) return;
    this.boss2MoveTween.stop();
    this.boss2MoveTween = null;
  }

  drawBoss2LaserLine(beam, { color, alpha, width }) {
    const g = this.add.graphics();
    g.setDepth(1200);
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(beam.x1, beam.y1);
    g.lineTo(beam.x2, beam.y2);
    g.strokePath();
    this.boss2LaserVisuals.push(g);
    return g;
  }

  clearBoss2LaserVisuals() {
    if (!this.boss2LaserVisuals?.length) return;
    this.boss2LaserVisuals.forEach(v => {
      if (v?.active) v.destroy();
    });
    this.boss2LaserVisuals.length = 0;
  }

  getBoss2LaserBeam() {
    const sx = this.boss?.sprite?.x ?? 640;
    const sy = this.boss?.sprite?.y ?? 180;
    const px = Phaser.Math.Clamp(this.player?.sprite?.x ?? sx, 0, this.worldWidth);
    const py = Phaser.Math.Clamp(this.player?.sprite?.y ?? sy + 1, 0, 720);

    let vx = px - sx;
    let vy = py - sy;
    const len = Math.hypot(vx, vy);

    // 플레이어와 거의 같은 좌표면 기본적으로 아래 방향으로 발사
    if (len < 0.0001) {
      vx = 0;
      vy = 1;
    } else {
      vx /= len;
      vy /= len;
    }

    const minX = 0;
    const maxX = this.worldWidth;
    const minY = 0;
    const maxY = 720;
    const tCandidates = [];

    if (vx > 0.0001) tCandidates.push((maxX - sx) / vx);
    else if (vx < -0.0001) tCandidates.push((minX - sx) / vx);

    if (vy > 0.0001) tCandidates.push((maxY - sy) / vy);
    else if (vy < -0.0001) tCandidates.push((minY - sy) / vy);

    let tEnd = 1200;
    for (const t of tCandidates) {
      if (t > 0 && t < tEnd) tEnd = t;
    }

    return {
      x1: sx,
      y1: sy,
      x2: sx + vx * tEnd,
      y2: sy + vy * tEnd
    };
  }

  getPlayerLaserCollisionPoints() {
    if (!this.player?.sprite?.active) return [];
    const body = this.player.sprite.body;
    const cx = this.player.sprite.x;
    const cy = this.player.sprite.y;
    if (!body) {
      return [{ x: cx, y: cy }];
    }

    const left = body.left;
    const right = body.right;
    const top = body.top;
    const bottom = body.bottom;
    const midX = (left + right) * 0.5;
    const midY = (top + bottom) * 0.5;

    return [
      { x: midX, y: midY },
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: midX, y: top },
      { x: midX, y: bottom },
      { x: left, y: midY },
      { x: right, y: midY }
    ];
  }

  distancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0.0001) {
      const ddx = px - x1;
      const ddy = py - y1;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Phaser.Math.Clamp(t, 0, 1);
    const cx = x1 + t * dx;
    const cy = y1 + t * dy;
    const ddx = px - cx;
    const ddy = py - cy;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  applyBoss2LaserHit(beam, width = 34, baseDamage = 3) {
    if (!this.player?.sprite?.active || !this.player.isAlive()) return;
    const points = this.getPlayerLaserCollisionPoints();
    let hit = false;
    for (const p of points) {
      const dist = this.distancePointToSegment(p.x, p.y, beam.x1, beam.y1, beam.x2, beam.y2);
      if (dist <= width) {
        hit = true;
        break;
      }
    }

    if (hit) {
      this.player.takeDamage(this.getBoss2ScaledDamage(baseDamage), this.time.now);
      if (!this.player.isAlive()) {
        this.handlePlayerDeath();
      }
    }
  }

  killPlayerFromBoss2Pattern() {
    if (!this.player || this.ending || !this.player.isAlive()) return;
    this.player.health = 0;
    this.player.defeat();
    this.handlePlayerDeath();
  }

  runBoss2LaserAction(actionToken, action) {
    if (!this.boss?.sprite?.active) {
      this.queueBoss2Timer(1200, () => this.runNextBoss2Action());
      return;
    }

    this.boss2State = 'pattern2-laser';
    if (this.boss) {
      this.boss.invincible = true;
    }
    const isPhase2 = this.boss2Phase >= 2;
    const extraShots = this.isBoss2HalfHpBuffActive() ? 2 : 0;
    const totalShotsBase = (isPhase2 ? Phaser.Math.Between(5, 9) : Phaser.Math.Between(2, 6)) + extraShots;
    const totalShots = Math.max(1, Math.round(totalShotsBase * this.bossLaserCountMultiplier));
    const fireIntervalMs = this.getBoss2FasterDelay(isPhase2 ? 350 : 500);
    const warningLeadMs = isPhase2 ? 750 : 1000;

    if (this.patternText) {
      this.patternText.setText(`패턴2: 레이저 ${totalShots}연사`);
      this.patternText.setColor('#ffb347');
    }

    for (let i = 0; i < totalShots; i += 1) {
      const shotNumber = i + 1;
      const shotAtMs = warningLeadMs + i * fireIntervalMs;
      const warningAtMs = Math.max(0, shotAtMs - warningLeadMs);
      let warningGraphic = null;
      let beam = null;

      this.queueBoss2Timer(warningAtMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (this.ending) return;
        beam = this.getBoss2LaserBeam();
        warningGraphic = this.drawBoss2LaserLine(beam, {
          color: 0xff9900,
          alpha: 0.95,
          width: 10
        });

        if (this.patternText) {
          this.patternText.setText(`패턴2: 경고 ${shotNumber}/${totalShots}`);
          this.patternText.setColor('#ffae42');
        }
      });

      this.queueBoss2Timer(shotAtMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (warningGraphic?.active) warningGraphic.destroy();
        if (!beam) beam = this.getBoss2LaserBeam();

        const laser = this.drawBoss2LaserLine(beam, {
          color: 0xff3355,
          alpha: 1,
          width: isPhase2 ? 22 : 18
        });
        this.applyBoss2LaserHit(beam, isPhase2 ? 44 : 36, 3);

        if (this.patternText) {
          this.patternText.setText(`패턴2: 발사 ${shotNumber}/${totalShots}`);
          this.patternText.setColor('#ff5e5e');
        }

        this.queueBoss2Timer(150, () => {
          if (this.isBoss2ActionStale(actionToken)) return;
          if (laser?.active) laser.destroy();
        });
      });
    }

    const finalShotAt = warningLeadMs + (totalShots - 1) * fireIntervalMs;
    if (!isPhase2) {
      this.queueBoss2Timer(finalShotAt + 900, () => {
        this.finishBoss2Action(actionToken, action);
      });
      return;
    }

    const missileStartAt = finalShotAt + 400;
    const missileCount = 4;
    const missileIntervalMs = 220;

    this.queueBoss2Timer(missileStartAt, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      if (this.patternText) {
        this.patternText.setText('패턴2: 유도 미사일 전개');
        this.patternText.setColor('#ff7ea1');
      }
    });

    for (let i = 0; i < missileCount; i += 1) {
      this.queueBoss2Timer(missileStartAt + i * missileIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        this.spawnBoss2HomingMissile(i);
      });
    }

    const missileFinishAt = missileStartAt + (missileCount - 1) * missileIntervalMs;
    const postMissileLaserCount = Math.max(1, Math.round(Phaser.Math.Between(20, 40) * this.bossLaserCountMultiplier));
    const postMissileLaserIntervalMs = 100;
    const postMissileLaserWarningLeadMs = 500;
    const missileHomingEndAt = missileFinishAt + 3000;
    const postMissileLaserStartAt = missileHomingEndAt + 120;

    this.queueBoss2Timer(postMissileLaserStartAt, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      if (this.patternText) {
        this.patternText.setText(`패턴2: 미사일 후속 레이저 ${postMissileLaserCount}연사`);
        this.patternText.setColor('#ff4f7a');
      }
    });

    for (let i = 0; i < postMissileLaserCount; i += 1) {
      const shotNumber = i + 1;
      const shotAtMs = postMissileLaserStartAt + i * postMissileLaserIntervalMs;
      const warningAtMs = Math.max(0, shotAtMs - postMissileLaserWarningLeadMs);
      let warningGraphic = null;
      let beam = null;

      this.queueBoss2Timer(warningAtMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        beam = this.getBoss2LaserBeam();
        warningGraphic = this.drawBoss2LaserLine(beam, {
          color: 0xff9900,
          alpha: 0.95,
          width: 10
        });

        if (this.patternText) {
          this.patternText.setText(`패턴2: 후속 경고 ${shotNumber}/${postMissileLaserCount}`);
          this.patternText.setColor('#ffae42');
        }
      });

      this.queueBoss2Timer(shotAtMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (warningGraphic?.active) warningGraphic.destroy();
        if (!beam) beam = this.getBoss2LaserBeam();
        const laser = this.drawBoss2LaserLine(beam, {
          color: 0xff2f55,
          alpha: 1,
          width: 20
        });
        this.applyBoss2LaserHit(beam, 60, 4);

        if (this.patternText) {
          this.patternText.setText(`패턴2: 후속 레이저 ${shotNumber}/${postMissileLaserCount}`);
          this.patternText.setColor('#ff5e5e');
        }

        this.queueBoss2Timer(120, () => {
          if (this.isBoss2ActionStale(actionToken)) return;
          if (laser?.active) laser.destroy();
        });
      });
    }

    const postMissileLaserFinishAt = postMissileLaserStartAt + (postMissileLaserCount - 1) * postMissileLaserIntervalMs;

    // 2페이즈 2번째 턴은 레이저 -> 미사일 -> 창 연계를 보장한다.
    const comboSpikeStartAt = postMissileLaserFinishAt + 220;
    const comboLeftShots = Phaser.Math.Between(2, 4);
    const comboRightShots = Phaser.Math.Between(2, 4);
    const comboSpikeIntervalMs = 170;
    const comboRightDelayMs = 80;

    this.queueBoss2Timer(comboSpikeStartAt, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      if (this.patternText) {
        this.patternText.setText(`패턴2: 후속 창 좌${comboLeftShots}/우${comboRightShots}`);
        this.patternText.setColor('#ff9f68');
      }
    });

    for (let i = 0; i < comboLeftShots; i += 1) {
      this.queueBoss2Timer(comboSpikeStartAt + i * comboSpikeIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (this.ending) return;
        const targetY = Phaser.Math.Clamp(this.player?.sprite?.y ?? 540, 120, 640);
        this.spawnBoss2SideSpike(true, targetY);
      });
    }

    for (let i = 0; i < comboRightShots; i += 1) {
      this.queueBoss2Timer(comboSpikeStartAt + comboRightDelayMs + i * comboSpikeIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (this.ending) return;
        const targetY = Phaser.Math.Clamp(this.player?.sprite?.y ?? 540, 120, 640);
        this.spawnBoss2SideSpike(false, targetY);
      });
    }

    const comboLastSpawnAt = comboSpikeStartAt + comboRightDelayMs + (Math.max(comboLeftShots, comboRightShots) - 1) * comboSpikeIntervalMs;
    this.queueBoss2Timer(comboLastSpawnAt + 850, () => {
      this.finishBoss2Action(actionToken, action);
    });
  }

  spawnBoss2HomingMissile(slot = 0) {
    if (!this.boss?.sprite?.active || !this.player?.sprite?.active || this.ending) return null;

    const sourceX = this.boss.sprite.x;
    const sourceY = this.boss.sprite.y + 10;
    const offsetX = (slot - 1.5) * 130;
    const missile = this.physics.add.image(sourceX + offsetX, sourceY, 'boss2-missile-real');
    missile.setDisplaySize(130, 130);
    missile.setFlip(true, true);
    missile.setDepth(1185);
    missile.setTint(0xff8dad);
    missile._bornAt = this.time.now;
    missile._expireAt = this.time.now + 3000;
    missile._speed = Math.round(this.scaleBossBattleSpeed(330));
    missile._turnRate = Math.min(0.45, 0.15 * this.bossBattleSpeedMultiplier);
    missile._nextHitAt = 0;

    if (missile.body) {
      missile.body.setAllowGravity(false);
      missile.body.allowGravity = false;
      missile.body.setGravity(0, 0);
      missile.body.setDrag(0, 0);
      const maxV = Math.round(this.scaleBossBattleSpeed(480));
      missile.body.setMaxVelocity(maxV, maxV);
      missile.body.setCircle(40, 25, 25);
      missile.body.setVelocity(
        Phaser.Math.Between(-30, 30) * this.bossBattleSpeedMultiplier,
        90 * this.bossBattleSpeedMultiplier
      );
    }

    this.boss2HomingMissiles?.add(missile);

    return missile;
  }

  onBoss2HomingMissileOverlap(missile) {
    if (this.ending || !this.player?.isAlive() || !missile?.active) return;
    const now = this.time.now;
    if (now < (missile._nextHitAt || 0)) return;
    missile._nextHitAt = now + 100;
    
    // 미사일을 즉시 비활성화해서 중복 충돌 방지
    missile.setActive(false);
    
    this.player.takeDamage(3, now);
    
    // 플레이어가 죽었는지 확인
    if (!this.player.isAlive()) {
      this.handlePlayerDeath();
    }
    
    // 미사일 파괴는 나중에
    this.time.delayedCall(10, () => {
      if (missile?.active) missile.destroy();
    });
  }

  runBoss2CrossLaserAction(actionToken, action) {
    if (this.isBoss2ActionStale(actionToken)) return;
    this.boss2State = 'pattern4-cross-laser';
    if (this.boss) {
      this.boss.invincible = true;
    }

    const burstCount = Math.max(1, Math.round(Phaser.Math.Between(3, 5) * this.bossLaserCountMultiplier));
    const warningLeadMs = 700;
    const intervalMs = 480;

    if (this.patternText) {
      this.patternText.setText(`패턴4: 크로스 레이저 ${burstCount}회`);
      this.patternText.setColor('#ff8a4c');
    }

    for (let i = 0; i < burstCount; i += 1) {
      const warningAt = i * intervalMs;
      const fireAt = warningAt + warningLeadMs;
      let warningGraphics = [];
      let beams = [];

      this.queueBoss2Timer(warningAt, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        beams = this.getBoss2CrossBeams();
        warningGraphics = beams.map(beam => this.drawBoss2LaserLine(beam, {
          color: 0xffc457,
          alpha: 0.9,
          width: 9
        }));

        if (this.patternText) {
          this.patternText.setText(`패턴4: 경고 ${i + 1}/${burstCount}`);
          this.patternText.setColor('#ffb36b');
        }
      });

      this.queueBoss2Timer(fireAt, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        warningGraphics.forEach(g => {
          if (g?.active) g.destroy();
        });
        if (!beams.length) beams = this.getBoss2CrossBeams();

        const fired = beams.map(beam => this.drawBoss2LaserLine(beam, {
          color: 0xff3c57,
          alpha: 1,
          width: 16
        }));
        beams.forEach(beam => this.applyBoss2LaserHit(beam, 34));

        if (this.patternText) {
          this.patternText.setText(`패턴4: 발사 ${i + 1}/${burstCount}`);
          this.patternText.setColor('#ff6f79');
        }

        this.queueBoss2Timer(130, () => {
          if (this.isBoss2ActionStale(actionToken)) return;
          fired.forEach(g => {
            if (g?.active) g.destroy();
          });
        });
      });
    }

    const finishAt = warningLeadMs + (burstCount - 1) * intervalMs;
    this.queueBoss2Timer(finishAt + 850, () => {
      this.finishBoss2Action(actionToken, action);
    });
  }

  getBoss2CrossBeams() {
    const px = Phaser.Math.Clamp(this.player?.sprite?.x ?? this.worldWidth / 2, 80, this.worldWidth - 80);
    const left = { x1: 72, y1: 96, x2: px + 90, y2: 690 };
    const right = { x1: this.worldWidth - 72, y1: 96, x2: px - 90, y2: 690 };
    return [left, right];
  }

  fireBoss2GlobalCrossLaser() {
    if (this.ending || !this.player?.isAlive()) return;
    const beams = this.getBoss2CrossBeams();
    const fired = beams.map(beam => this.drawBoss2LaserLine(beam, {
      color: 0xff4669,
      alpha: 1,
      width: 15
    }));
    beams.forEach(beam => this.applyBoss2LaserHit(beam, 34, 2));

    this.queueBoss2Timer(120, () => {
      fired.forEach(g => {
        if (g?.active) g.destroy();
      });
    });
  }

  startBoss2GlobalCrossLaserLoop() {
    if (this.boss2GlobalCrossLaserTimer) return;
    this.boss2GlobalCrossLaserTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.ending || !this.sys?.isActive()) return;
        this.fireBoss2GlobalCrossLaser();
      }
    });
  }

  clearBoss2GlobalCrossLaserLoop() {
    if (!this.boss2GlobalCrossLaserTimer) return;
    this.boss2GlobalCrossLaserTimer.remove(false);
    this.boss2GlobalCrossLaserTimer = null;
  }

  spawnBoss2SideSpike(fromLeft, y) {
    if (!this.player?.sprite?.active || this.ending) return;
    const wallInset = 36;
    const x = fromLeft ? wallInset : this.worldWidth - wallInset;
    const speed = Math.round(this.scaleBossBattleSpeed(520));
    const velocityX = fromLeft ? speed : -speed;

    const spike = this.physics.add.image(x, y, 'boss2-spear');
    spike.setDisplaySize(112, 20);
    spike.setAngle(fromLeft ? 0 : 180);
    spike.setDepth(1100);
    spike._fromLeft = fromLeft;
    spike._vx = velocityX;
    spike._fixedY = y;
    spike._targetWallX = fromLeft ? this.worldWidth - wallInset : wallInset;
    spike._countedAsArrived = false;

    this.boss2SpikeProjectiles?.add(spike);

    if (spike.body) {
      spike.body.setEnable(true);
      spike.body.setAllowGravity(false);
      spike.body.allowGravity = false;
      spike.body.setGravity(0, 0);
      spike.body.setImmovable(false);
      spike.body.moves = true;
      spike.body.setAcceleration(0, 0);
      spike.body.setDrag(0, 0);
      spike.body.setMaxVelocity(700, 0);
      spike.body.setVelocityY(0);
      spike.body.setVelocityX(velocityX);
      spike.body.setSize(92, 14, true);
    }

    return spike;
  }

  onBoss2SpikeOverlap(spike) {
    if (this.ending || !this.player?.isAlive() || !spike?.active) return;
    const now = this.time.now;
    if (now < (spike._nextHitAt || 0)) return;
    spike._nextHitAt = now + 120;
    this.player.takeDamage(1, now);
    if (!this.player.isAlive()) {
      this.handlePlayerDeath();
    }
  }

  handleBoss2Pattern3SpearArrived(spike) {
    if (!spike || spike._countedAsArrived) return;
    spike._countedAsArrived = true;
    this.boss2Pattern3Remaining = Math.max(0, (this.boss2Pattern3Remaining || 0) - 1);

    if (this.boss2Pattern3Remaining > 0) return;
    if (this.boss2Pattern3Finished || this.ending || this.boss2State !== 'pattern3-side-spike') return;

    this.boss2Pattern3Finished = true;
    this.finishBoss2Action(this.boss2Pattern3ActionToken, 2);
  }

  runBoss2SideSpikeAction(actionToken, action) {
    this.boss2State = 'pattern3-side-spike';
    if (this.boss) {
      this.boss.invincible = true;
    }
    this.boss2Pattern3ActionToken = actionToken;
    const isPhase2 = this.boss2Phase >= 2;
    const leftShots = isPhase2 ? Phaser.Math.Between(2, 5) : Phaser.Math.Between(1, 4);
    const rightShots = isPhase2 ? Phaser.Math.Between(2, 5) : Phaser.Math.Between(1, 4);
    const shotIntervalMs = isPhase2 ? 320 : 450;
    const rightStartDelayMs = isPhase2 ? 90 : 180;

    this.boss2Pattern3Remaining = leftShots + rightShots;
    this.boss2Pattern3Finished = false;

    if (this.boss2Pattern3Remaining <= 0) {
      this.finishBoss2Action(actionToken, action);
      return;
    }

    if (this.patternText) {
      this.patternText.setText(`패턴3: 좌${leftShots} / 우${rightShots} 창`);
      this.patternText.setColor('#ff9f68');
    }

    for (let i = 0; i < leftShots; i += 1) {
      this.queueBoss2Timer(i * shotIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (this.ending) return;
        const targetY = Phaser.Math.Clamp(this.player?.sprite?.y ?? 540, 120, 640);
        this.spawnBoss2SideSpike(true, targetY);
        if (this.patternText) {
          this.patternText.setText(`패턴3: 왼쪽 ${i + 1}/${leftShots}`);
          this.patternText.setColor('#ff7f50');
        }
      });
    }

    for (let i = 0; i < rightShots; i += 1) {
      this.queueBoss2Timer(rightStartDelayMs + i * shotIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (this.ending) return;
        const targetY = Phaser.Math.Clamp(this.player?.sprite?.y ?? 540, 120, 640);
        this.spawnBoss2SideSpike(false, targetY);
        if (this.patternText) {
          this.patternText.setText(`패턴3: 오른쪽 ${i + 1}/${rightShots}`);
          this.patternText.setColor('#ff7f50');
        }
      });
    }

    // 모든 스파이크가 생성된 후 충분한 시간이 지나면 강제로 패턴 종료 (타임아웃)
    const lastSpikeAt = rightStartDelayMs + (rightShots - 1) * shotIntervalMs;
    const timeoutMs = lastSpikeAt + 2500; // 마지막 스파이크 생성 후 2.5초
    this.queueBoss2Timer(timeoutMs, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      if (this.boss2Pattern3Finished) return;
      if (this.ending) return;
      // 패턴이 아직 진행 중이면 강제 종료
      if (this.boss2State === 'pattern3-side-spike') {
        this.finishBoss2Action(actionToken, action);
      }
    });
  }

  collapseFloorSegment(index) {
    const seg = this.floorSegments?.[index];
    if (!seg || seg.collapsed || !seg.sprite?.active) return;

    seg.collapsed = true;
    this.boss2CollapsedSegments.add(index);
    seg.sprite.disableBody(true, true);
  }

  restoreFloorSegment(index) {
    const seg = this.floorSegments?.[index];
    if (!seg || !seg.collapsed || !seg.sprite) return;

    seg.collapsed = false;
    this.boss2CollapsedSegments.delete(index);
    seg.sprite.enableBody(false, seg.sprite.x, seg.sprite.y, true, true);
    seg.sprite.refreshBody();
    seg.sprite.clearTint();
    seg.sprite.setAlpha(1);
  }

  restoreCollapsedFloorSegments() {
    if (!this.floorSegments) return;
    this.boss2CollapsedSegments.forEach(index => {
      const seg = this.floorSegments[index];
      if (!seg || !seg.sprite) return;
      seg.collapsed = false;
      seg.sprite.enableBody(false, seg.sprite.x, seg.sprite.y, true, true);
      seg.sprite.refreshBody();
      seg.sprite.clearTint();
      seg.sprite.setAlpha(1);
    });
    this.boss2CollapsedSegments.clear();
  }

  runBoss2FloorCollapseAction(actionToken, action) {
    if (!this.floorSegments?.length) {
      this.queueBoss2Timer(1200, () => this.runNextBoss2Action());
      return;
    }

    this.boss2State = 'pattern1-collapse';
    if (this.boss) {
      this.boss.invincible = true;
    }
    const leftToRight = Math.random() < 0.5;
    const ordered = [...this.floorSegments].sort((a, b) => {
      const ax = a?.sprite?.x ?? 0;
      const bx = b?.sprite?.x ?? 0;
      return leftToRight ? ax - bx : bx - ax;
    });

    if (this.patternText) {
      this.patternText.setText(leftToRight ? '패턴1: 왼쪽부터 붕괴' : '패턴1: 오른쪽부터 붕괴');
      this.patternText.setColor('#ffb347');
    }

    const baseCollapseIntervalMs = this.boss2Phase >= 2 ? 700 + 500 : 500;
    const collapseIntervalMs = this.getBoss2FasterDelay(baseCollapseIntervalMs);
    ordered.forEach((seg, i) => {
      // 붕괴 1초 전에 빨간색으로 표시
      this.queueBoss2Timer(Math.max(0, i * collapseIntervalMs - 1000), () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (!seg?.sprite?.active || seg.collapsed) return;
        seg.sprite.setTint(0xff0000); // 빨간색 경고
      });

      // 실제 붕괴
      this.queueBoss2Timer(i * collapseIntervalMs, () => {
        if (this.isBoss2ActionStale(actionToken)) return;
        if (!seg?.sprite?.active || seg.collapsed) return;
        this.collapseFloorSegment(seg.index);
      });
    });

    const collapseFinishedAt = (ordered.length - 1) * collapseIntervalMs;
    this.queueBoss2Timer(collapseFinishedAt, () => {
      if (this.isBoss2ActionStale(actionToken)) return;
      if (this.patternText) {
        this.patternText.setText('패턴1: 반대 방향 복구');
        this.patternText.setColor('#ffd8a8');
      }

      const restoreOrdered = [...ordered].reverse();
      const restoreIntervalMs = this.getBoss2FasterDelay(1000);
      restoreOrdered.forEach((seg, i) => {
        this.queueBoss2Timer(i * restoreIntervalMs, () => {
          if (this.isBoss2ActionStale(actionToken)) return;
          this.restoreFloorSegment(seg.index);
        });
      });

      const restoreFinishedAt = (restoreOrdered.length - 1) * restoreIntervalMs;
      this.queueBoss2Timer(restoreFinishedAt + 900, () => {
        this.finishBoss2Action(actionToken, action);
      });
    });
  }

  // ── 보스2 기본 루프 ─────────────────────
  updateBoss2(time) {
    if (this.ending || !this.boss?.sprite?.active) return;
    this.maybeTriggerBoss2Phase2();
    if (!this.boss2PatternStarted && !this.boss2ActionLoopScheduled && !this.boss2ActionRunning) {
      this.startBoss2PatternLoop();
    }

    if (this.boss2ShieldVisual) {
      this.boss2ShieldVisual.clear();
      if (this.boss.invincible) {
        const bx = this.boss.sprite.x;
        const by = this.boss.sprite.y;
        this.boss2ShieldVisual.lineStyle(6, 0xff3344, 0.95);
        this.boss2ShieldVisual.strokeCircle(bx, by, 112);
        this.boss2ShieldVisual.lineStyle(2, 0xff8a95, 0.85);
        this.boss2ShieldVisual.strokeCircle(bx, by, 126);
      }
    }

    if (this.boss2SpikeProjectiles) {
      const minX = -220;
      const maxX = this.worldWidth + 220;
      this.boss2SpikeProjectiles.getChildren().forEach(spike => {
        if (!spike?.active) return;

        // 창은 중력/가속을 무시하고 반드시 수평 직선으로 이동한다.
        spike.y = spike._fixedY ?? spike.y;
        if (spike.body) {
          spike.body.setAllowGravity(false);
          spike.body.allowGravity = false;
          spike.body.setGravity(0, 0);
          spike.body.setVelocityY(0);
          const baseSpeed = Math.round(this.scaleBossBattleSpeed(520));
          const expectedVx = spike._vx ?? (spike._fromLeft ? baseSpeed : -baseSpeed);
          if (Math.abs((spike.body.velocity?.x ?? 0) - expectedVx) > 1) {
            spike.body.setVelocityX(expectedVx);
          }
        }

        const reachedOppositeWall = spike._fromLeft
          ? spike.x >= (spike._targetWallX ?? this.worldWidth + 96)
          : spike.x <= (spike._targetWallX ?? -96);

        if (reachedOppositeWall) {
          this.handleBoss2Pattern3SpearArrived(spike);
          spike.destroy();
          return;
        }

        if (spike.x < minX || spike.x > maxX) {
          this.handleBoss2Pattern3SpearArrived(spike);
          spike.destroy();
        }
      });
    }

    if (this.boss2HomingMissiles) {
      const minX = -80;
      const maxX = this.worldWidth + 80;
      this.boss2HomingMissiles.getChildren().forEach(missile => {
        if (!missile?.active) return;

        const now = this.time.now;
        if (now >= (missile._expireAt || 0)) {
          missile.destroy();
          return;
        }

        const tx = this.player?.sprite?.x ?? missile.x;
        const ty = this.player?.sprite?.y ?? missile.y;
        const desiredAngle = Phaser.Math.Angle.Between(missile.x, missile.y, tx, ty);

        const body = missile.body;
        if (!body) return;
        body.setAllowGravity(false);
        body.allowGravity = false;
        body.setGravity(0, 0);

        const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
        const turnRate = missile._turnRate ?? 0.15;
        const nextAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, turnRate);
        const speed = missile._speed ?? 330;
        body.setVelocity(Math.cos(nextAngle) * speed, Math.sin(nextAngle) * speed);
        missile.setRotation(nextAngle - Math.PI / 2);

        if (missile.x < minX || missile.x > maxX || missile.y < -80 || missile.y > 820) {
          missile.destroy();
        }
      });
    }

    if (this.boss.sprite.body) {
      if (this.boss2AnchorLocked && this.boss2Anchor) {
        this.boss.sprite.setPosition(this.boss2Anchor.x, this.boss2Anchor.y);
      }
      this.boss.sprite.body.setAllowGravity(false);
      this.boss.sprite.body.setVelocityX(0);
      this.boss.sprite.body.setVelocityY(0);
    }
  }

  clearBoss2SpikeProjectiles() {
    const group = this.boss2SpikeProjectiles;
    if (!group) {
      this.boss2Pattern3Remaining = 0;
      this.boss2Pattern3Finished = true;
      return;
    }

    // Scene shutdown 순서에 따라 group.children 이 먼저 파기될 수 있어 방어적으로 처리한다.
    const hasChildren = !!group.children;
    const children = hasChildren && group.getChildren ? group.getChildren() : [];
    children.forEach(spike => {
      if (spike?.active) spike.destroy();
    });

    if (group.clear) {
      group.clear(true, true);
    }
    this.boss2Pattern3Remaining = 0;
    this.boss2Pattern3Finished = true;
  }

  clearBoss2HomingMissiles() {
    const group = this.boss2HomingMissiles;
    if (!group) return;

    const hasChildren = !!group.children;
    const children = hasChildren && group.getChildren ? group.getChildren() : [];
    children.forEach(missile => {
      if (missile?.active) missile.destroy();
    });

    if (group.clear) {
      group.clear(true, true);
    }
  }

  clearBoss2ShieldVisual() {
    if (!this.boss2ShieldVisual) return;
    if (this.boss2ShieldVisual.active) {
      this.boss2ShieldVisual.clear();
      this.boss2ShieldVisual.destroy();
    }
    this.boss2ShieldVisual = null;
  }

  shutdownBoss2PatternSystems() {
    this.boss2ActionToken = (this.boss2ActionToken || 0) + 1;
    try { this.clearBoss2MoveTween(); } catch (_) {}
    this.boss2AnchorLocked = true;
    if (this.boss) {
      this.boss.invincible = true;
    }
    try { this.clearBoss2Timers(); } catch (_) {}
    try { this.restoreCollapsedFloorSegments(); } catch (_) {}
    try { this.clearBoss2LaserVisuals(); } catch (_) {}
    try { this.clearBoss2SpikeProjectiles(); } catch (_) {}
    try { this.clearBoss2HomingMissiles(); } catch (_) {}
    try { this.clearBoss2ShieldVisual(); } catch (_) {}
    try { this.clearBoss2GlobalCrossLaserLoop(); } catch (_) {}
  }

}

