import Phaser from 'phaser';
import { createPetTextures } from '../sprites/createPetTextures';

type PetState = 'idle' | 'walking' | 'happy' | 'dragging';

const PET_FRAME_HEIGHT = 48;

export class PetScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private pet!: Phaser.GameObjects.Sprite;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private state: PetState = 'idle';
  private nextActionAt = 0;
  private walkTargetX = 0;
  private walkDirection = 1;
  private walkSpeed = 58;

  private pointerDownAt = 0;
  private pointerDownPosition = new Phaser.Math.Vector2();
  private hasDragged = false;
  private interactionLocked = false;

  constructor() {
    super('PetScene');
  }

  create(): void {
    createPetTextures(this);
    this.createAnimations();

    this.background = this.add.graphics();
    this.drawRoom(this.scale.width, this.scale.height);

    this.titleText = this.add
      .text(this.scale.width / 2, 30, '今天也要开心呀', {
        color: '#74485a',
        fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.statusText = this.add
      .text(this.scale.width / 2, 68, '小宠物醒来啦！', {
        color: '#9c5a73',
        backgroundColor: '#ffffffcc',
        fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
        fontSize: '15px',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.hintText = this.add
      .text(this.scale.width / 2, this.scale.height - 34, '点一下她 · 也可以拖动她', {
        color: '#8d6071',
        fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
        fontSize: '14px',
      })
      .setOrigin(0.5, 1)
      .setDepth(20);

    const petScale = this.getPetScale();
    this.pet = this.add
      .sprite(this.scale.width / 2, this.getFloorY() - (PET_FRAME_HEIGHT * petScale) / 2, 'pet-idle-0')
      .setScale(petScale)
      .setDepth(10)
      .setInteractive({ cursor: 'pointer' });

    this.pet.play('pet-idle');
    this.input.setDraggable(this.pet);
    this.configureInput();
    this.scheduleIdle(this.time.now + 1800);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });

    const loading = document.querySelector<HTMLDivElement>('#loading');
    loading?.classList.add('is-hidden');
    window.setTimeout(() => loading?.remove(), 250);
  }

  update(time: number, delta: number): void {
    if (!this.pet || this.state === 'happy' || this.state === 'dragging') {
      return;
    }

    if (this.state === 'walking') {
      const step = this.walkDirection * this.walkSpeed * (delta / 1000);
      const nextX = this.pet.x + step;
      const reachedTarget =
        (this.walkDirection > 0 && nextX >= this.walkTargetX) ||
        (this.walkDirection < 0 && nextX <= this.walkTargetX);

      if (reachedTarget) {
        this.pet.x = this.walkTargetX;
        this.scheduleIdle(time + Phaser.Math.Between(1300, 3000));
      } else {
        this.pet.x = nextX;
      }
      return;
    }

    if (time >= this.nextActionAt) {
      if (Math.random() < 0.68) {
        this.startWalking();
      } else {
        this.statusText.setText(Phaser.Utils.Array.GetRandom(['在发呆…', '偷偷看你', '伸了个懒腰']));
        this.pet.play('pet-idle', true);
        this.nextActionAt = time + Phaser.Math.Between(1700, 3300);
      }
    }
  }

  private createAnimations(): void {
    this.anims.create({
      key: 'pet-idle',
      frames: [0, 1, 2, 1].map((index) => ({ key: `pet-idle-${index}` })),
      frameRate: 3,
      repeat: -1,
    });

    this.anims.create({
      key: 'pet-walk',
      frames: Array.from({ length: 6 }, (_, index) => ({ key: `pet-walk-${index}` })),
      frameRate: 9,
      repeat: -1,
    });

    this.anims.create({
      key: 'pet-happy',
      frames: Array.from({ length: 6 }, (_, index) => ({ key: `pet-happy-${index}` })),
      frameRate: 10,
      repeat: 0,
    });
  }

  private configureInput(): void {
    this.pet.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.pointerDownAt = pointer.downTime;
      this.pointerDownPosition.set(pointer.x, pointer.y);
      this.hasDragged = false;
    });

    this.pet.on(Phaser.Input.Events.DRAG_START, () => {
      this.hasDragged = true;
      this.state = 'dragging';
      this.interactionLocked = false;
      this.tweens.killTweensOf(this.pet);
      this.pet.stop();
      this.pet.setTexture('pet-happy-1');
      this.statusText.setText('要带我去哪里呀？');
    });

    this.pet.on(
      Phaser.Input.Events.DRAG,
      (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        const marginX = this.pet.displayWidth * 0.42;
        const marginY = this.pet.displayHeight * 0.42;
        this.pet.x = Phaser.Math.Clamp(dragX, marginX, this.scale.width - marginX);
        this.pet.y = Phaser.Math.Clamp(dragY, 115 + marginY, this.getFloorY() - marginY * 0.35);
      },
    );

    this.pet.on(Phaser.Input.Events.DRAG_END, () => {
      this.hasDragged = true;
      this.state = 'dragging';
      this.tweens.add({
        targets: this.pet,
        y: this.getPetGroundY(),
        duration: 260,
        ease: 'Bounce.Out',
        onComplete: () => {
          this.statusText.setText('这里也不错～');
          this.scheduleIdle(this.time.now + 1200);
        },
      });
    });

    this.pet.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      const moved = Phaser.Math.Distance.Between(
        this.pointerDownPosition.x,
        this.pointerDownPosition.y,
        pointer.x,
        pointer.y,
      );
      const heldFor = pointer.upTime - this.pointerDownAt;

      if (!this.hasDragged && moved < 12 && heldFor < 450) {
        this.triggerHappyReaction();
      }
    });
  }

  private triggerHappyReaction(): void {
    if (this.interactionLocked) {
      return;
    }

    this.interactionLocked = true;
    this.state = 'happy';
    this.tweens.killTweensOf(this.pet);
    this.pet.play('pet-happy', true);
    this.statusText.setText(Phaser.Utils.Array.GetRandom(['嘿嘿，被你发现啦！', '好喜欢你！', '再摸摸我嘛～']));
    this.spawnHearts();

    this.tweens.add({
      targets: this.pet,
      y: this.getPetGroundY() - 20,
      duration: 150,
      yoyo: true,
      ease: 'Quad.Out',
    });

    this.pet.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.interactionLocked = false;
      this.scheduleIdle(this.time.now + 1400);
    });
  }

  private spawnHearts(): void {
    const heartOffsets = [-30, 4, 34];
    heartOffsets.forEach((offsetX, index) => {
      const heart = this.add
        .text(this.pet.x + offsetX, this.pet.y - this.pet.displayHeight * 0.42, index === 1 ? '♥' : '♡', {
          color: index === 1 ? '#ef5f91' : '#f08daf',
          fontFamily: 'sans-serif',
          fontSize: index === 1 ? '28px' : '22px',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(30)
        .setAlpha(0);

      this.tweens.add({
        targets: heart,
        alpha: { from: 0, to: 1 },
        y: heart.y - 65 - index * 9,
        x: heart.x + (index - 1) * 10,
        duration: 700,
        delay: index * 90,
        ease: 'Sine.Out',
        onComplete: () => heart.destroy(),
      });
    });
  }

  private startWalking(): void {
    const margin = this.pet.displayWidth * 0.55;
    const minX = margin;
    const maxX = Math.max(minX + 1, this.scale.width - margin);
    let targetX = Phaser.Math.Between(Math.ceil(minX), Math.floor(maxX));

    if (Math.abs(targetX - this.pet.x) < 70) {
      targetX = this.pet.x < this.scale.width / 2 ? maxX : minX;
    }

    this.walkTargetX = targetX;
    this.walkDirection = targetX >= this.pet.x ? 1 : -1;
    this.pet.setFlipX(this.walkDirection < 0);
    this.pet.play('pet-walk', true);
    this.statusText.setText(Phaser.Utils.Array.GetRandom(['去那边看看', '散散步～', '哒哒哒…']));
    this.state = 'walking';
  }

  private scheduleIdle(nextActionAt: number): void {
    this.state = 'idle';
    this.pet.y = this.getPetGroundY();
    this.pet.play('pet-idle', true);
    this.nextActionAt = nextActionAt;
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const width = gameSize.width;
    const height = gameSize.height;
    this.drawRoom(width, height);

    this.titleText.setPosition(width / 2, 30);
    this.statusText.setPosition(width / 2, 68);
    this.hintText.setPosition(width / 2, height - 34);

    const petScale = this.getPetScale();
    this.pet.setScale(petScale);
    const margin = this.pet.displayWidth * 0.5;
    this.pet.x = Phaser.Math.Clamp(this.pet.x, margin, Math.max(margin, width - margin));
    this.pet.y = this.getPetGroundY();
  }

  private drawRoom(width: number, height: number): void {
    if (!this.background) {
      return;
    }

    const floorY = height * 0.72;
    this.background.clear();

    // Wall and floor.
    this.background.fillStyle(0xfff1f6, 1).fillRect(0, 0, width, floorY);
    this.background.fillStyle(0xf4cfbf, 1).fillRect(0, floorY, width, height - floorY);
    this.background.fillStyle(0xe8b8a8, 1).fillRect(0, floorY, width, 5);

    // Tiny pixel-pattern wallpaper.
    this.background.fillStyle(0xf8cedd, 0.5);
    for (let y = 135; y < floorY - 40; y += 70) {
      for (let x = 28 + ((y / 70) % 2) * 24; x < width; x += 82) {
        this.background.fillRect(Math.round(x), Math.round(y), 5, 5);
        this.background.fillRect(Math.round(x + 5), Math.round(y + 5), 5, 5);
      }
    }

    // Window.
    const windowWidth = Phaser.Math.Clamp(width * 0.34, 120, 210);
    const windowHeight = Phaser.Math.Clamp(height * 0.18, 115, 175);
    const windowX = width * 0.11;
    const windowY = height * 0.19;
    this.background.fillStyle(0xffffff, 1).fillRoundedRect(windowX - 8, windowY - 8, windowWidth + 16, windowHeight + 16, 8);
    this.background.fillStyle(0xbde7f3, 1).fillRect(windowX, windowY, windowWidth, windowHeight);
    this.background.fillStyle(0xffffff, 0.72).fillRect(windowX + 18, windowY + 26, windowWidth * 0.34, 12);
    this.background.fillStyle(0xffffff, 0.72).fillRect(windowX + 34, windowY + 15, windowWidth * 0.25, 11);
    this.background.fillStyle(0xffffff, 1).fillRect(windowX + windowWidth / 2 - 3, windowY, 6, windowHeight);
    this.background.fillStyle(0xffffff, 1).fillRect(windowX, windowY + windowHeight / 2 - 3, windowWidth, 6);

    // Shelf and plant.
    const shelfX = width * 0.7;
    const shelfY = height * 0.34;
    this.background.fillStyle(0xc68e7b, 1).fillRect(shelfX - 45, shelfY + 45, 110, 10);
    this.background.fillStyle(0xe1899e, 1).fillRect(shelfX - 21, shelfY + 17, 42, 30);
    this.background.fillStyle(0x67a879, 1).fillRect(shelfX - 3, shelfY - 17, 7, 36);
    this.background.fillStyle(0x7abb88, 1).fillRect(shelfX - 22, shelfY - 18, 20, 13);
    this.background.fillStyle(0x589e70, 1).fillRect(shelfX + 4, shelfY - 28, 22, 14);

    // Rug and floor highlights.
    const rugWidth = Phaser.Math.Clamp(width * 0.58, 220, 520);
    this.background.fillStyle(0xe9a9bc, 1).fillEllipse(width / 2, floorY + (height - floorY) * 0.56, rugWidth, Math.min(105, height * 0.13));
    this.background.fillStyle(0xf8d3df, 1).fillEllipse(width / 2, floorY + (height - floorY) * 0.54, rugWidth * 0.78, Math.min(62, height * 0.075));
    this.background.setDepth(0);
  }

  private getPetScale(): number {
    const widthScale = this.scale.width / 390;
    const heightScale = this.scale.height / 844;
    return Phaser.Math.Clamp(Math.min(widthScale, heightScale) * 3.15, 2.65, 4.25);
  }

  private getFloorY(): number {
    return this.scale.height * 0.72;
  }

  private getPetGroundY(): number {
    return this.getFloorY() - this.pet.displayHeight * 0.48;
  }
}
