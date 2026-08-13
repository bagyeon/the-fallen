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
    const base = import.meta.env.BASE_URL;
    this.load.image('placeholder', `${base}assets/placeholder.png`);
    this.load.image('game-background', `${base}resource/img/backgroud_1.png`);
    this.load.image('stage1-bg', `${base}resource/img/forset.jpg`);
    this.load.image('stage2-bg', `${base}resource/img/desert.avif`);
    this.load.image('boss-bg', `${base}resource/img/던전.png`);
    this.load.image('weapon-sword', `${base}resource/img/sword.png`);
    this.load.image('player-melee', `${base}resource/img/siba.png`);
    this.load.image('boss', `${base}resource/img/boss.png`);
    this.load.audio('boss-bgm', `${base}resource/sound/boss1.mp3`);
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

    this.createPixelTexture('platform-tile', 64, 24, (graphics) => {
      px(graphics, 0, 0, 64, 24, 0x3d4a5c);
      px(graphics, 0, 0, 64, 5, 0x5a6e84);
      px(graphics, 0, 0, 64, 2, 0x7a92a8);
      px(graphics, 7, 8, 11, 3, 0x2e3844);
      px(graphics, 36, 10, 13, 3, 0x2e3844);
      px(graphics, 20, 5, 7, 2, 0x8aa0b4);
      px(graphics, 48, 6, 9, 2, 0x8aa0b4);
    });

    this.createPixelTexture('forest-platform-tile', 64, 24, (graphics) => {
      px(graphics, 0, 0, 64, 24, 0x5c3d1e);
      px(graphics, 0, 0, 64, 5, 0x7a5428);
      px(graphics, 0, 0, 64, 2, 0x9c7040);
      px(graphics, 8, 7, 14, 2, 0x3d2610);
      px(graphics, 30, 9, 18, 2, 0x3d2610);
      px(graphics, 52, 6, 10, 2, 0x3d2610);
      px(graphics, 20, 4, 5, 1, 0xb8884a);
      px(graphics, 44, 3, 6, 1, 0xb8884a);
    });

    this.createPixelTexture('weapon-melee', 24, 24, (graphics) => {
      px(graphics, 11, 2, 3, 16, 0xd9e2f2);
      px(graphics, 7, 5, 11, 3, 0xf5f1d8);
      px(graphics, 9, 17, 7, 3, 0xb98d52);
      px(graphics, 6, 18, 4, 4, 0x7b5534);
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

    this.createPixelTexture('lab-ground-tile', 64, 32, (g) => {
      g.fillStyle(0x252830, 1); g.fillRect(0, 0, 64, 32);
      g.fillStyle(0x3a3f48, 1); g.fillRect(0, 0, 64, 5);
      g.fillStyle(0x4d545e, 1); g.fillRect(0, 0, 64, 1);
      g.fillStyle(0x1a1d22, 1); g.fillRect(0, 28, 64, 4);
      g.fillStyle(0x1e2128, 1);
      g.fillRect(8, 7, 12, 4); g.fillRect(36, 9, 14, 4);
      g.fillRect(20, 17, 10, 3); g.fillRect(50, 19, 8, 3);
      g.fillStyle(0x3a3f48, 1);
      g.fillRect(4, 24, 6, 2); g.fillRect(44, 22, 8, 2);
    });

    this.createPixelTexture('lab-platform-tile', 64, 24, (g) => {
      g.fillStyle(0x2c3140, 1); g.fillRect(0, 0, 64, 24);
      g.fillStyle(0x4a5270, 1); g.fillRect(0, 0, 64, 3);
      g.fillStyle(0x6875a0, 1); g.fillRect(0, 0, 64, 1);
      for (let i = 0; i < 8; i++) {
        g.fillStyle(i % 2 === 0 ? 0xe8c012 : 0x1a1a1a, 1);
        g.fillRect(i * 8, 16, 8, 8);
      }
      g.fillStyle(0x1e2438, 1);
      g.fillRect(10, 5, 5, 4); g.fillRect(40, 6, 5, 4);
    });

    this.createPixelTexture('ceiling-tile', 64, 20, (g) => {
      g.fillStyle(0x252830, 1); g.fillRect(0, 0, 64, 20);
      g.fillStyle(0x3a3f48, 1); g.fillRect(0, 0, 64, 3);
      for (let i = 0; i < 8; i++) {
        g.fillStyle(i % 2 === 0 ? 0xe8c012 : 0x1a1a1a, 1);
        g.fillRect(i * 8, 14, 8, 6);
      }
      g.fillStyle(0x3a3f48, 1);
      g.fillRect(6, 4, 5, 5); g.fillRect(24, 4, 5, 5);
      g.fillRect(42, 4, 5, 5); g.fillRect(58, 4, 5, 5);
    });

    this.createPixelTexture('trap-fire', 24, 36, (g) => {
      g.fillStyle(0x2a2a2a, 1); g.fillRect(4, 28, 16, 8);
      g.fillStyle(0xd4450a, 1); g.fillTriangle(12, 2, 3, 28, 21, 28);
      g.fillStyle(0xf58020, 1); g.fillTriangle(12, 6, 6, 26, 18, 26);
      g.fillStyle(0xffd020, 1); g.fillTriangle(12, 10, 8, 24, 16, 24);
      g.fillStyle(0xffffa0, 1); g.fillRect(10, 10, 4, 10);
    });

    this.createPixelTexture('trap-saw', 48, 48, (g) => {
      g.fillStyle(0x5c6166, 1); g.fillCircle(24, 24, 23);
      g.fillStyle(0x3c4044, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillRect(24 + Math.cos(a) * 17 - 3, 24 + Math.sin(a) * 17 - 3, 6, 6);
      }
      g.fillStyle(0x3c4044, 1); g.fillCircle(24, 24, 12);
      g.fillStyle(0x6c7177, 1); g.fillCircle(24, 24, 7);
      g.fillStyle(0x2c2e32, 1); g.fillCircle(24, 24, 3);
      g.fillStyle(0x8c9196, 1); g.fillCircle(19, 18, 3);
    });

    this.createPixelTexture('lab-wall-tile', 32, 64, (g) => {
      g.fillStyle(0x2b2f3a, 1); g.fillRect(0, 0, 32, 64);
      g.fillStyle(0x4c5468, 1); g.fillRect(0, 0, 32, 4);
      g.fillStyle(0x7d8697, 1); g.fillRect(0, 0, 32, 2);
      g.fillStyle(0x1b1d22, 1); g.fillRect(8, 10, 16, 5); g.fillRect(6, 28, 20, 5); g.fillRect(10, 46, 12, 5);
    });

    this.createPixelTexture('trap-laser', 128, 12, (g) => {
      g.fillStyle(0x2c2d34, 1); g.fillRect(0, 0, 128, 12);
      g.fillStyle(0xff4d6d, 1); g.fillRect(4, 2, 120, 8);
      g.fillStyle(0xffd1dc, 1); g.fillRect(10, 4, 108, 2);
    });

    this.createPixelTexture('trap-spike', 128, 24, (g) => {
      g.fillStyle(0x2a2d35, 1); g.fillRect(0, 10, 128, 14);
      g.fillStyle(0x7c8490, 1);
      for (let i = 0; i < 8; i++) {
        const sx = i * 16 + 8;
        g.fillTriangle(sx, 0, sx - 7, 14, sx + 7, 14);
      }
      g.fillStyle(0xb0b8c0, 1);
      for (let i = 0; i < 8; i++) {
        g.fillRect(i * 16 + 7, 0, 2, 4);
      }
    });

    this.createPixelTexture('door-tile', 80, 120, (g) => {
      g.fillStyle(0x3c4458, 1); g.fillRect(0, 0, 80, 120);
      g.fillStyle(0x14181e, 1); g.fillRect(6, 4, 68, 112);
      g.fillStyle(0x2c3450, 1); g.fillRect(6, 55, 68, 8);
      g.fillStyle(0x004433, 0.5); g.fillRect(31, 6, 18, 46); g.fillRect(31, 66, 18, 46);
      g.fillStyle(0x00ff88, 1); g.fillRect(37, 6, 6, 46); g.fillRect(37, 66, 6, 46);
      g.fillStyle(0x80ffcc, 1); g.fillRect(36, 5, 8, 3); g.fillRect(36, 110, 8, 3);
      g.fillStyle(0x4c5570, 1);
      g.fillRect(10, 8, 7, 7); g.fillRect(63, 8, 7, 7);
      g.fillRect(10, 105, 7, 7); g.fillRect(63, 105, 7, 7);
    });

    // 알 형태 보스2
    this.createPixelTexture('boss2-egg', 72, 90, (g) => {
      // 외곽 테두리 (밝은 보라)
      px(g, 28, 0, 16, 4, 0x8840e8);
      px(g, 18, 4, 36, 6, 0x8840e8);
      px(g, 8, 10, 56, 12, 0x8840e8);
      px(g, 4, 22, 64, 34, 0x8840e8);
      px(g, 8, 56, 56, 14, 0x8840e8);
      px(g, 18, 70, 36, 10, 0x8840e8);
      px(g, 28, 80, 16, 8, 0x8840e8);
      // 몸통 (중간 보라)
      px(g, 30, 3, 12, 3, 0x5c28a8);
      px(g, 20, 6, 32, 5, 0x5c28a8);
      px(g, 10, 11, 52, 10, 0x5c28a8);
      px(g, 6, 21, 60, 32, 0x5c28a8);
      px(g, 10, 53, 52, 12, 0x5c28a8);
      px(g, 20, 65, 32, 8, 0x5c28a8);
      px(g, 30, 73, 12, 6, 0x5c28a8);
      // 내부 빛
      px(g, 12, 12, 48, 8, 0x7038c8);
      px(g, 8, 20, 56, 28, 0x7038c8);
      px(g, 12, 48, 48, 10, 0x7038c8);
      // 눈 배경 (흰색 계열)
      px(g, 22, 26, 28, 22, 0xb080f0);
      // 홍채 (밝은 자홍)
      px(g, 26, 29, 20, 16, 0xe860ff);
      // 동공 (어두움)
      px(g, 30, 31, 12, 12, 0x200040);
      // 하이라이트
      px(g, 32, 33, 4, 4, 0xffffff);
      // 에너지 균열 (밝은 선)
      px(g, 35, 50, 2, 12, 0xf0a0ff);
      px(g, 27, 54, 2, 7, 0xf0a0ff);
      px(g, 43, 54, 2, 7, 0xf0a0ff);
    });

    this.createPixelTexture('boss2-projectile', 12, 12, (g) => {
      g.fillStyle(0x2050c0, 1); g.fillCircle(6, 6, 5);
      g.fillStyle(0x4090ff, 1); g.fillCircle(6, 6, 3);
      g.fillStyle(0xa0d0ff, 1); g.fillCircle(5, 5, 2);
    });

    this.scene.start('Title');
  }
}
