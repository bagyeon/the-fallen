import Phaser from 'phaser';

const DIFF_CONFIG = {
  easy:   { label: 'EASY',   color: '#44ee88', hpMult: 1.5,  dmgMult: 0.6 },
  normal: { label: 'NORMAL', color: '#ffe08a', hpMult: 1.0,  dmgMult: 1.0 },
  hard:   { label: 'HARD',   color: '#ff8844', hpMult: 0.7,  dmgMult: 1.5 },
  dorai:  { label: 'DORAI',  color: '#ff3366', hpMult: 0.3,  dmgMult: 2.5 },
};

// 현재는 1, 2번 스테이지만 활성화, 나머지는 추후 개발 예정
const STAGE_LIST = [
  { id: 1, name: 'THE FALLEN',  active: true  },
  { id: 2, name: 'LAB ESCAPE',  active: true  },
  { id: 3, name: '???',         active: false },
  { id: 4, name: '???',         active: false },
  { id: 5, name: '???',         active: false },
  { id: 6, name: '???',         active: false },
  { id: 7, name: '???',         active: false },
  { id: 8, name: '???',         active: false },
  { id: 9, name: '???',         active: false },
];

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

    this.add.text(width / 2, 70, 'THE FALLEN', {
      fontFamily: 'Arial', fontSize: '62px', fontStyle: 'bold', color: '#f6d58a'
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, `난이도: ${diff.label}`, {
      fontFamily: 'Arial', fontSize: '24px', color: diff.color
    }).setOrigin(0.5);

    this.add.text(width / 2, 195, '플레이할 스테이지를 선택하세요', {
      fontFamily: 'Arial', fontSize: '20px', color: '#aabbcc'
    }).setOrigin(0.5);

    // 3x3 그리드 버튼 배치
    const btnW = 210, btnH = 110, cols = 3, rows = 3;
    const gapX = 30, gapY = 22;
    const gridW = cols * btnW + (cols - 1) * gapX;
    const gridH = rows * btnH + (rows - 1) * gapY;
    const startX = (width - gridW) / 2 + btnW / 2;
    const startY = 250;

    STAGE_LIST.forEach((stage, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = startX + col * (btnW + gapX);
      const cy = startY + row * (btnH + gapY);

      if (stage.active) {
        // 활성 버튼
        const bg = this.add.rectangle(cx, cy, btnW, btnH, 0x1a2e4a, 1)
          .setInteractive({ useHandCursor: true })
          .setStrokeStyle(2, 0x4488cc, 1);

        const numText = this.add.text(cx, cy - 18, `${stage.id}`, {
          fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#f6d58a'
        }).setOrigin(0.5);

        const nameText = this.add.text(cx, cy + 26, stage.name, {
          fontFamily: 'Arial', fontSize: '15px', color: '#e8f4ff'
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
          bg.setFillStyle(0x2a4870);
          numText.setColor('#ffffff');
          nameText.setColor('#ffffff');
        });
        bg.on('pointerout', () => {
          bg.setFillStyle(0x1a2e4a);
          numText.setColor('#f6d58a');
          nameText.setColor('#e8f4ff');
        });
        bg.on('pointerdown', () => {
          bg.disableInteractive();
          this.selectedStage = stage.id;
          this.startVortex();
        });
      } else {
        // 비활성 버튼 (잠금)
        this.add.rectangle(cx, cy, btnW, btnH, 0x111825, 1)
          .setStrokeStyle(1, 0x334455, 0.5);

        this.add.text(cx, cy - 18, `${stage.id}`, {
          fontFamily: 'Arial', fontSize: '36px', fontStyle: 'bold', color: '#334455'
        }).setOrigin(0.5);

        this.add.text(cx, cy + 26, '준비 중', {
          fontFamily: 'Arial', fontSize: '14px', color: '#334455'
        }).setOrigin(0.5);
      }
    });

    // 돌아가기 버튼
    const backBtn = this.add.text(width / 2, height - 38, '← 돌아가기', {
      fontFamily: 'Arial', fontSize: '20px', color: '#7799bb'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#aaccee'));
    backBtn.on('pointerout',  () => backBtn.setColor('#7799bb'));
    backBtn.on('pointerdown', () => this.scene.start('Title'));
  }

  startVortex() {
    const { width, height } = this.scale;

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
        this.scene.start('Stage', { stage: this.selectedStage ?? 1 });
      });
    });
  }
}
