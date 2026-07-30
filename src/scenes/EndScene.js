import Phaser from 'phaser';

export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create() {
    const { width, height } = this.scale;
    this.add.text(width/2, height/2 - 20, 'YOU WIN', { font: '48px Arial', color: '#aaffaa' }).setOrigin(0.5);
    this.add.text(width/2, height/2 + 40, 'Thanks for playing', { font: '20px Arial', color: '#fff' }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('Title');
    });
  }
}
