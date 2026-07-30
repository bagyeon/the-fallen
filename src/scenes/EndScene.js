import Phaser from 'phaser';

export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) {
    this.result = data?.result || 'win';
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(this.result === 'win' ? '#10251a' : '#2a1212');
    this.add.rectangle(width / 2, height / 2, width, height, this.result === 'win' ? 0x10251a : 0x2a1212, 1);

    const title = this.result === 'win' ? 'YOU WIN' : 'GAME OVER';
    const subtitle = this.result === 'win' ? '보스를 쓰러뜨렸습니다' : '플레이어가 쓰러졌습니다';

    this.add.text(width / 2, height / 2 - 32, title, {
      fontFamily: 'Arial',
      fontSize: '64px',
      color: this.result === 'win' ? '#aaf0a8' : '#ffaaaa'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 28, subtitle, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#edf3ff'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 110, 'ENTER를 눌러 타이틀로', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffe08a'
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('Title');
    });
  }
}
