import Phaser from 'phaser';

export default class Enemy {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'placeholder').setTint(0xff6666);
  }
}
