import Phaser from 'phaser';

interface PetPose {
  bodyOffsetY?: number;
  footPhase?: number;
  armPhase?: number;
  eyeMode?: 'open' | 'closed' | 'happy';
  cheek?: boolean;
  jump?: number;
}

const WIDTH = 32;
const HEIGHT = 48;

export function createPetTextures(scene: Phaser.Scene): void {
  const idleFrames: PetPose[] = [
    { bodyOffsetY: 0, eyeMode: 'open' },
    { bodyOffsetY: 1, eyeMode: 'open' },
    { bodyOffsetY: 1, eyeMode: 'closed' },
  ];

  const walkFrames: PetPose[] = Array.from({ length: 6 }, (_, index) => ({
    bodyOffsetY: index % 2,
    footPhase: index % 3,
    armPhase: index % 2,
    eyeMode: 'open',
  }));

  const happyFrames: PetPose[] = [
    { eyeMode: 'open', cheek: true },
    { eyeMode: 'happy', cheek: true, armPhase: 1, jump: 1 },
    { eyeMode: 'happy', cheek: true, armPhase: 2, jump: 2 },
    { eyeMode: 'happy', cheek: true, armPhase: 1, jump: 2 },
    { eyeMode: 'happy', cheek: true, armPhase: 2, jump: 1 },
    { eyeMode: 'happy', cheek: true, armPhase: 1 },
  ];

  idleFrames.forEach((pose, index) => drawPetFrame(scene, `pet-idle-${index}`, pose));
  walkFrames.forEach((pose, index) => drawPetFrame(scene, `pet-walk-${index}`, pose));
  happyFrames.forEach((pose, index) => drawPetFrame(scene, `pet-happy-${index}`, pose));
}

function drawPetFrame(scene: Phaser.Scene, key: string, pose: PetPose): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const bodyY = pose.bodyOffsetY ?? 0;
  const jump = pose.jump ?? 0;
  const y = bodyY - jump;
  const footPhase = pose.footPhase ?? 0;
  const armPhase = pose.armPhase ?? 0;

  // Hair behind the head.
  graphics.fillStyle(0x4a3040, 1);
  graphics.fillRect(8, 5 + y, 16, 17);
  graphics.fillRect(6, 10 + y, 4, 13);
  graphics.fillRect(22, 10 + y, 4, 14);
  graphics.fillRect(9, 3 + y, 14, 4);

  // Face.
  graphics.fillStyle(0xf6cbb7, 1);
  graphics.fillRect(10, 8 + y, 12, 12);
  graphics.fillRect(8, 11 + y, 16, 7);

  // Fringe.
  graphics.fillStyle(0x4a3040, 1);
  graphics.fillRect(8, 6 + y, 16, 5);
  graphics.fillRect(9, 10 + y, 4, 3);
  graphics.fillRect(18, 9 + y, 5, 3);

  // Eyes.
  graphics.fillStyle(0x432f38, 1);
  if (pose.eyeMode === 'closed') {
    graphics.fillRect(11, 15 + y, 3, 1);
    graphics.fillRect(18, 15 + y, 3, 1);
  } else if (pose.eyeMode === 'happy') {
    graphics.fillRect(11, 14 + y, 1, 2);
    graphics.fillRect(12, 13 + y, 2, 1);
    graphics.fillRect(18, 13 + y, 2, 1);
    graphics.fillRect(20, 14 + y, 1, 2);
  } else {
    graphics.fillRect(11, 13 + y, 2, 3);
    graphics.fillRect(19, 13 + y, 2, 3);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(11, 13 + y, 1, 1);
    graphics.fillRect(19, 13 + y, 1, 1);
  }

  if (pose.cheek) {
    graphics.fillStyle(0xec8fa4, 1);
    graphics.fillRect(8, 17 + y, 3, 2);
    graphics.fillRect(21, 17 + y, 3, 2);
  }

  // Dress/body.
  graphics.fillStyle(0xe46f91, 1);
  graphics.fillRect(10, 21 + y, 12, 14);
  graphics.fillRect(8, 29 + y, 16, 8);
  graphics.fillStyle(0xf7a6bb, 1);
  graphics.fillRect(13, 21 + y, 6, 4);
  graphics.fillRect(10, 33 + y, 12, 2);

  // Arms. Happy frames raise both arms.
  graphics.fillStyle(0xf6cbb7, 1);
  if (armPhase === 2) {
    graphics.fillRect(5, 19 + y, 4, 9);
    graphics.fillRect(23, 19 + y, 4, 9);
    graphics.fillRect(4, 18 + y, 4, 3);
    graphics.fillRect(24, 18 + y, 4, 3);
  } else if (armPhase === 1) {
    graphics.fillRect(6, 23 + y, 4, 9);
    graphics.fillRect(22, 21 + y, 4, 9);
  } else {
    graphics.fillRect(7, 23 + y, 3, 10);
    graphics.fillRect(22, 23 + y, 3, 10);
  }

  // Legs and shoes.
  const leftFootX = footPhase === 1 ? 8 : 10;
  const rightFootX = footPhase === 2 ? 20 : 18;
  graphics.fillStyle(0xf3c4b1, 1);
  graphics.fillRect(leftFootX, 37 + y, 4, 7);
  graphics.fillRect(rightFootX, 37 + y, 4, 7);
  graphics.fillStyle(0x6f4a5a, 1);
  graphics.fillRect(leftFootX - 1, 43 + y, 6, 3);
  graphics.fillRect(rightFootX - 1, 43 + y, 6, 3);

  // Tiny hair highlight.
  graphics.fillStyle(0x6a4559, 1);
  graphics.fillRect(11, 5 + y, 7, 2);

  graphics.generateTexture(key, WIDTH, HEIGHT);
  graphics.destroy();
}
