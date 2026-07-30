import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import StageScene from './scenes/StageScene.js';
import BossScene from './scenes/BossScene.js';
import EndScene from './scenes/EndScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#222222',
  physics: { default: 'arcade', arcade: { gravity: { y: 1000 }, debug: false } },
  scene: [BootScene, TitleScene, StageScene, BossScene, EndScene]
};

window.game = new Phaser.Game(config);
