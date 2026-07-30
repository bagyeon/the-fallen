import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  createPixelTexture(key, width, height, drawFn) {
    const graphics = this.add.graphics();
    drawFn(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  preload() {
    this.load.image('placeholder', '/assets/placeholder.png');
  }

  create() {
    const px = (graphics, x, y, w, h, color, alpha = 1) => {
      graphics.fillStyle(color, alpha);
      graphics.fillRect(x, y, w, h);
    };

    this.createPixelTexture('ground-tile', 64, 32, (graphics) => {
      px(graphics, 0, 0, 64, 32, 0x5c4632);
      px(graphics, 0, 0, 64, 6, 0x7a5c3b);
      px(graphics, 6, 8, 10, 4, 0x8f714d);
      px(graphics, 34, 10, 12, 4, 0x8f714d);
      px(graphics, 16, 18, 8, 3, 0x6c5339);
      px(graphics, 46, 20, 7, 3, 0x6c5339);
    });

    this.createPixelTexture('weapon-melee', 24, 24, (graphics) => {
      px(graphics, 11, 2, 3, 16, 0xd9e2f2);
      px(graphics, 7, 5, 11, 3, 0xf5f1d8);
      px(graphics, 9, 17, 7, 3, 0xb98d52);
      px(graphics, 6, 18, 4, 4, 0x7b5534);
    });

    this.createPixelTexture('player-melee', 48, 64, (graphics) => {
      px(graphics, 17, 4, 14, 12, 0xf0d5a8);
      px(graphics, 14, 14, 20, 16, 0x81b9ff);
      px(graphics, 13, 30, 8, 24, 0x2d3952);
      px(graphics, 27, 30, 8, 24, 0x2d3952);
      px(graphics, 11, 20, 5, 8, 0x81b9ff);
      px(graphics, 32, 20, 5, 8, 0x81b9ff);
      px(graphics, 34, 18, 8, 3, 0xd9e2f2);
      px(graphics, 31, 17, 4, 5, 0xb98d52);
      px(graphics, 17, 6, 3, 2, 0x25303f);
      px(graphics, 28, 6, 3, 2, 0x25303f);
    });

    this.createPixelTexture('enemy-basic', 48, 56, (graphics) => {
      px(graphics, 15, 5, 18, 12, 0x89d17d);
      px(graphics, 13, 15, 22, 18, 0x3f8f55);
      px(graphics, 12, 33, 8, 18, 0x275235);
      px(graphics, 28, 33, 8, 18, 0x275235);
      px(graphics, 10, 18, 5, 7, 0x6abf6b);
      px(graphics, 33, 18, 5, 7, 0x6abf6b);
      px(graphics, 17, 7, 3, 3, 0x122017);
      px(graphics, 28, 7, 3, 3, 0x122017);
      px(graphics, 18, 22, 12, 3, 0x1a2417);
    });

    this.createPixelTexture('enemy-elite', 48, 56, (graphics) => {
      px(graphics, 15, 4, 18, 12, 0xf4c06a);
      px(graphics, 13, 15, 22, 18, 0xc86c2c);
      px(graphics, 12, 33, 8, 18, 0x72391d);
      px(graphics, 28, 33, 8, 18, 0x72391d);
      px(graphics, 10, 18, 5, 7, 0xe69d35);
      px(graphics, 33, 18, 5, 7, 0xe69d35);
      px(graphics, 17, 7, 3, 3, 0x2b1408);
      px(graphics, 28, 7, 3, 3, 0x2b1408);
      px(graphics, 18, 22, 12, 3, 0x361708);
    });

    this.createPixelTexture('boss', 72, 80, (graphics) => {
      px(graphics, 24, 6, 24, 16, 0xffa46b);
      px(graphics, 18, 20, 36, 22, 0x8d3d7a);
      px(graphics, 16, 42, 12, 26, 0x4f2446);
      px(graphics, 44, 42, 12, 26, 0x4f2446);
      px(graphics, 12, 25, 6, 10, 0xd86b8f);
      px(graphics, 54, 25, 6, 10, 0xd86b8f);
      px(graphics, 24, 9, 4, 4, 0x2b0f17);
      px(graphics, 39, 9, 4, 4, 0x2b0f17);
      px(graphics, 28, 26, 16, 4, 0x2a1727);
      px(graphics, 20, 50, 32, 6, 0x6c295b);
    });

    this.scene.start('Title');
  }
}
