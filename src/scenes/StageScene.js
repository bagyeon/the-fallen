import Phaser from 'phaser';
import Player from '../entities/Player.js';

export default class StageScene extends Phaser.Scene {
  constructor() { super('Stage'); }

  init(data) { this.stage = data.stage || 1; }

  create() {
    const { width, height } = this.scale;
    this.add.text(10,10, `Stage ${this.stage}`, { font: '18px Arial', color: '#fff' });

    // simple ground
    const ground = this.add.rectangle(400, 580, 1600, 40, 0x444444);
    this.physics.add.existing(ground, true);

    // player
    this.player = new Player(this, 100, 450);
    this.add.existing(this.player.sprite);
    this.physics.add.existing(this.player.sprite);
    this.player.sprite.body.setCollideWorldBounds(true);
    this.player.sprite.body.setSize(40, 80).setOffset(44, 24);

    this.physics.add.collider(this.player.sprite, ground);

    // placeholder enemy
    this.enemies = this.physics.add.group();
    const enemy = this.physics.add.sprite(500, 450, 'placeholder').setScale(0.5).setTint(0xff6666);
    enemy.body.setSize(40,80);
    this.enemies.add(enemy);
    this.physics.add.collider(enemy, ground);

    this.physics.add.overlap(this.player.bullets, this.enemies, (bullet, e) => {
      bullet.destroy();
      e.destroy();
    });

    this.input.keyboard.on('keydown-N', () => {
      // advance to next stage for testing
      const next = this.stage + 1;
      if (next > 10) this.scene.start('Boss');
      else this.scene.start('Title');
    });
  }

  update(time, delta) {
    this.player.update(time, delta);
  }
}
