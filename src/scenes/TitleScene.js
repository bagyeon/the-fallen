import Phaser from 'phaser';

if (window.debugMode === undefined) window.debugMode = false;
if (window.difficulty === undefined) window.difficulty = 'normal';

const DIFFICULTIES = ['easy', 'normal', 'hard', 'dorai'];
const DIFF_LABELS = {
  easy:   { label: 'EASY',   color: '#44ee88', desc: '적 피해 감소 / 체력 1.5배' },
  normal: { label: 'NORMAL', color: '#ffe08a', desc: '기본 설정' },
  hard:   { label: 'HARD',   color: '#ff8844', desc: '적 피해 증가 / 체력 0.7배' },
  dorai:  { label: 'DORAI',  color: '#ff3366', desc: '극한 난이도' },
};

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#10151f');
    const bg = this.add.image(width / 2, height / 2, 'game-background');
    bg.setDisplaySize(width, height);
    bg.setDepth(-1000);

    this.add.rectangle(width / 2, height / 2, width, height, 0x111827, 0.55);
    this.add.rectangle(width / 2, height / 2 + 30, width * 0.72, height * 0.82, 0x0f1724, 0.94);

    // 타이틀 + 디버그 버튼
    this.add.text(width / 2, 68, 'THE FALLEN', {
      fontFamily: 'Arial', fontSize: '64px', fontStyle: 'bold', color: '#f6d58a'
    }).setOrigin(0.5);

    const dbgBtn = this.add.text(width / 2 + 340, 68, '', {
      fontFamily: 'Arial', fontSize: '16px', color: '#667788'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const updateDbg = () => {
      dbgBtn.setText(window.debugMode ? '[DEBUG: ON]' : '[DEBUG: OFF]');
      dbgBtn.setColor(window.debugMode ? '#44ff88' : '#667788');
    };
    dbgBtn.on('pointerdown', () => { window.debugMode = !window.debugMode; updateDbg(); });
    updateDbg();

    // 훈련장 버튼
    this.add.text(width / 2, 148, '— 훈 련 장 —', {
      fontFamily: 'Arial', fontSize: '20px', color: '#7799bb'
    }).setOrigin(0.5);

    const trainingBtnBox = this.add.rectangle(width / 2, 270, 360, 90, 0x12243a, 1)
      .setStrokeStyle(2, 0x4b6d90, 0.95)
      .setInteractive({ useHandCursor: true });

    const trainingBtnLabel = this.add.text(width / 2, 258, '훈련장', {
      fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#e8f3ff'
    }).setOrigin(0.5);

    const trainingBtnSub = this.add.text(width / 2, 286, '기본 동작 연습하기', {
      fontFamily: 'Arial', fontSize: '14px', color: '#9ec2e6'
    }).setOrigin(0.5);

    trainingBtnBox.on('pointerover', () => {
      trainingBtnBox.setFillStyle(0x1a3554, 1);
      trainingBtnBox.setStrokeStyle(2.5, 0x79b2ee, 1);
      trainingBtnLabel.setColor('#ffffff');
    });
    trainingBtnBox.on('pointerout', () => {
      trainingBtnBox.setFillStyle(0x12243a, 1);
      trainingBtnBox.setStrokeStyle(2, 0x4b6d90, 0.95);
      trainingBtnLabel.setColor('#e8f3ff');
    });
    trainingBtnBox.on('pointerdown', () => this.scene.start('Stage', { stage: 0, step: 1, stepLabelBase: 'T' }));

    // 난이도 선택
    this.add.text(width / 2, 430, '— 난 이 도 선 택 —', {
      fontFamily: 'Arial', fontSize: '20px', color: '#7799bb'
    }).setOrigin(0.5);

    const diffBtns = {};
    DIFFICULTIES.forEach((key, i) => {
      const d = DIFF_LABELS[key];
      const bx = width / 2 + (i - 1.5) * 195;
      const box = this.add.rectangle(bx, 510, 175, 62, 0x0d1a2a, 1)
        .setStrokeStyle(2, 0x334455, 0.8)
        .setInteractive({ useHandCursor: true });
      const lbl = this.add.text(bx, 498, d.label, {
        fontFamily: 'Arial', fontSize: '20px', fontStyle: 'bold', color: d.color
      }).setOrigin(0.5);
      const sub = this.add.text(bx, 524, d.desc, {
        fontFamily: 'Arial', fontSize: '11px', color: '#778899'
      }).setOrigin(0.5);
      diffBtns[key] = { box, lbl };

      box.on('pointerdown', () => {
        window.difficulty = key;
        refreshDiff();
      });
    });

    const refreshDiff = () => {
      DIFFICULTIES.forEach(k => {
        const active = k === window.difficulty;
        const d = DIFF_LABELS[k];
        diffBtns[k].box.setFillStyle(active ? 0x1a3050 : 0x0d1a2a);
        diffBtns[k].box.setStrokeStyle(active ? 2.5 : 1.5, active ? 0x66aaff : 0x334455, active ? 1 : 0.6);
      });
    };
    refreshDiff();

    // 다음 버튼
    const nextBtn = this.add.text(width / 2, 632, '다음  ▶', {
      fontFamily: 'Arial', fontSize: '30px', fontStyle: 'bold', color: '#ffe08a'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    nextBtn.on('pointerover', () => nextBtn.setColor('#ffffff'));
    nextBtn.on('pointerout',  () => nextBtn.setColor('#ffe08a'));
    nextBtn.on('pointerdown', () => this.scene.start('Title2'));
    this.input.keyboard.once('keydown-ENTER', () => this.scene.start('Title2'));
  }
}
