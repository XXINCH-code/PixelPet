import Phaser from 'phaser';
import './style.css';
import { PetScene } from './scenes/PetScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#fff1f6',
  antialias: false,
  pixelArt: true,
  roundPixels: true,
  transparent: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 2,
  },
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scene: [PetScene],
});

window.addEventListener('pagehide', () => {
  game.loop.sleep();
});

window.addEventListener('pageshow', () => {
  game.loop.wake();
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker.register(serviceWorkerUrl).catch((error: unknown) => {
      console.warn('Service Worker registration failed:', error);
    });
  });
}
