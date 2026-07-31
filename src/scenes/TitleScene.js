import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#10151f');
    const bgTexture = this.textures.get('game-background').getSourceImage();
    const bgScale = height / bgTexture.height;
    const background = this.add.tileSprite(width / 2, height / 2, width, height, 'game-background');
    background.setTileScale(bgScale, bgScale);
    background.setDepth(-1000);

    this.add.rectangle(width / 2, height / 2, width, height, 0x111827, 0.45);
    this.add.rectangle(width / 2, height / 2, width * 0.78, height * 0.55, 0x1d2938, 0.92);
    this.add.rectangle(width / 2, height / 2, width * 0.76, height * 0.52, 0x0f1724, 0.92);

    this.add.text(width / 2, 140, 'THE FALLEN', {
      fontFamily: 'Arial',
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#f6d58a'
    }).setOrigin(0.5);

    this.add.text(width / 2, 220, '픽셀풍 3스테이지 액션', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#9fb9ff'
    }).setOrigin(0.5);

    this.add.text(width / 2, 330, [
      '조작 방법',
      'A / D: 좌우 이동',
      'W: 점프 (공중에서 1회 상승 대시)',
      'Shift + A / D: 지상 돌진 대시',
      'S: 공중 급강하 (상승 대시 후 지면 강타)',
      'E / Q: 공중 720도 회전 공격',
      '좌클릭: 근접 공격'
    ], {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#e5eefc',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);

    this.add.text(width / 2, 610, 'ENTER를 눌러 시작', {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffe08a'
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('Stage', { stage: 1 });
    });
  }
}
