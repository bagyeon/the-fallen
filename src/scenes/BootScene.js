import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // placeholder graphics using geometry shapes will be used
    this.load.image('placeholder', '/assets/placeholder.png');
  }

  create() {
    this.scene.start('Title');
  }
}
