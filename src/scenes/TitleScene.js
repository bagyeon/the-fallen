import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#10151f');
    this.add.rectangle(width / 2, height / 2, width, height, 0x111827, 1);
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
      'WASD: 이동과 점프',
      '좌클릭: 현재 무기 공격',
      'Z: 앞으로 대시'
    ], {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#e5eefc',
      align: 'center',
      lineSpacing: 10
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
