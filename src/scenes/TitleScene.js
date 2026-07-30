import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width, height } = this.scale;
    this.add.text(width/2, height/2 - 40, 'THE FALLEN', { font: '48px Arial', color: '#ffd27f' }).setOrigin(0.5);
    this.add.text(width/2, height/2 + 20, 'Press ENTER to Start', { font: '20px Arial', color: '#fff' }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('Stage', { stage: 1 });
    });
  }
}
