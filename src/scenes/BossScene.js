import Phaser from 'phaser';

export default class BossScene extends Phaser.Scene {
  constructor() { super('Boss'); }

  create() {
    const { width, height } = this.scale;
    this.add.text(width/2, height/2, 'BOSS FIGHT', { font: '48px Arial', color: '#ff9999' }).setOrigin(0.5);
    this.add.text(width/2, height/2 + 60, 'Press ENTER to Win', { font: '20px Arial', color: '#fff' }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('End');
    });
  }
}
