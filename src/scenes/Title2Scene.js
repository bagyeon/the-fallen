import Phaser from 'phaser';

const DIFF_CONFIG = {
  easy:   { label: 'EASY',   color: '#44ee88', hpMult: 1.5,  dmgMult: 0.6 },
  normal: { label: 'NORMAL', color: '#ffe08a', hpMult: 1.0,  dmgMult: 1.0 },
  hard:   { label: 'HARD',   color: '#ff8844', hpMult: 0.7,  dmgMult: 1.5 },
  dorai:  { label: 'DORAI',  color: '#ff3366', hpMult: 0.3,  dmgMult: 2.5 },
};

export default class Title2Scene extends Phaser.Scene {
  constructor() { super('Title2'); }

  create() {
    const { width, height } = this.scale;
    const diff = DIFF_CONFIG[window.difficulty] || DIFF_CONFIG.normal;

    this.cameras.main.setBackgroundColor('#10151f');
    const bg = this.add.image(width / 2, height / 2, 'boss-bg');
    bg.setDisplaySize(width, height);
    bg.setDepth(-1000);
    this.add.rectangle(width / 2, height / 2, width, height, 0x060b14, 0.72);

    this.add.text(width / 2, 180, 'THE FALLEN', {
      fontFamily: 'Arial', fontSize: '88px', fontStyle: 'bold', color: '#f6d58a'
    }).setOrigin(0.5);

    this.add.text(width / 2, 290, `난이도: ${diff.label}`, {
      fontFamily: 'Arial', fontSize: '28px', color: diff.color
    }).setOrigin(0.5);

    // 게임 시작 버튼
    const btnBg = this.add.rectangle(width / 2, 430, 280, 70, 0x1a2e4a, 1).setInteractive({ useHandCursor: true });
    btnBg.setStrokeStyle(2, 0x4488cc, 0.9);
    const btnText = this.add.text(width / 2, 430, '게임 시작', {
      fontFamily: 'Arial', fontSize: '34px', fontStyle: 'bold', color: '#e8f4ff'
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => { btnBg.setFillStyle(0x2a4870); btnText.setColor('#ffffff'); });
    btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x1a2e4a); btnText.setColor('#e8f4ff'); });

    btnBg.on('pointerdown', () => {
      btnBg.disableInteractive();
      this.startVortex();
    });

    this.input.keyboard.once('keydown-ENTER', () => {
      btnBg.disableInteractive();
      this.startVortex();
    });
  }

  startVortex() {
    const { width, height } = this.scale;

    // 중앙으로 빨려들어가는 효과: 화면 줌인 + 회전
    this.tweens.add({
      targets: this.children.list.filter(o => o.depth >= 0),
      scaleX: 0, scaleY: 0,
      x: width / 2, y: height / 2,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeIn'
    });

    this.cameras.main.zoomTo(18, 700, 'Cubic.easeIn');

    this.time.delayedCall(680, () => {
      this.cameras.main.fade(120, 0, 0, 0);
      this.time.delayedCall(120, () => {
        this.scene.start('Stage', { stage: 1 });
      });
    });
  }
}
