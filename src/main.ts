import Phaser from 'phaser';
import './style.css';
import { GameScene } from './game/GameScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 600,
  height: 1000,
  backgroundColor: '#0c1412',
  scene: [GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
