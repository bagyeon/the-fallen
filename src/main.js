import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import StageScene from './scenes/StageScene.js';
import BossScene from './scenes/BossScene.js';
import EndScene from './scenes/EndScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#10151f',
  pixelArt: true,
  render: {
    antialias: false,
    roundPixels: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720
  },
  physics: { default: 'arcade', arcade: { gravity: { y: 1100 }, debug: false } },
  scene: [BootScene, TitleScene, StageScene, BossScene, EndScene]
};

window.game = new Phaser.Game(config);
