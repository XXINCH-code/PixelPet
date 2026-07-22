import Phaser from 'phaser';

type PetState = 'idle' | 'walking' | 'thinking' | 'reaction' | 'dragging';
type PetAction =
  | 'idle'
  | 'walk-right'
  | 'walk-left'
  | 'walk-dog'
  | 'thinking'
  | 'sorry'
  | 'sleep'
  | 'love'
  | 'handsome'
  | 'act-cute'
  | 'anniversary'
  | 'cheer'
  | 'dance'
  | 'give-flowers'
  | 'poke-reaction'
  | 'wave';

interface ActionConfig {
  frames: number;
  frameRate: number;
  repeat?: number;
  folder?: string;
}

const CLICK_WINDOW_MS = 420;
const DUPLICATE_TAP_GUARD_MS = 80;
const LONG_PRESS_MS = 600;

const ACTIONS: Record<PetAction, ActionConfig> = {
  idle: { folder: 'idles', frames: 10, frameRate: 2.5, repeat: -1 },
  'walk-right': { frames: 10, frameRate: 4.5, repeat: -1 },
  'walk-left': { frames: 10, frameRate: 4.5, repeat: -1 },
  'walk-dog': { frames: 10, frameRate: 4, repeat: -1 },
  thinking: { frames: 10, frameRate: 2.5 },
  sorry: { frames: 10, frameRate: 3 },
  sleep: { frames: 10, frameRate: 2.5 },
  love: { frames: 10, frameRate: 3.5 },
  handsome: { frames: 10, frameRate: 3 },
  'act-cute': { frames: 10, frameRate: 3 },
  anniversary: { frames: 10, frameRate: 3 },
  cheer: { frames: 10, frameRate: 3.5 },
  dance: { frames: 10, frameRate: 4 },
  'give-flowers': { frames: 10, frameRate: 3 },
  'poke-reaction': { frames: 10, frameRate: 3.5 },
  wave: { frames: 10, frameRate: 3 },
};

const RANDOM_ACTIONS: Array<{
  action: Exclude<PetAction, 'idle' | 'walk-left' | 'walk-right' | 'walk-dog'>;
  status: string;
}> = [
  { action: 'handsome', status: '今天也很帅气！' },
  { action: 'act-cute', status: '可爱一下～' },
  { action: 'anniversary', status: '这是给你的纪念礼物！' },
  { action: 'cheer', status: '一起加油！' },
  { action: 'dance', status: '跟着节奏跳起来～' },
  { action: 'give-flowers', status: '送你一束花！' },
  { action: 'poke-reaction', status: '咦？是谁戳我？' },
  { action: 'wave', status: '嗨～看到你啦！' },
];

const ACTION_WHEEL_ITEMS: Array<{
  action: Exclude<PetAction, 'idle' | 'walk-left' | 'walk-right' | 'thinking' | 'sorry' | 'sleep' | 'love' | 'poke-reaction'>;
  label: string;
  status: string;
}> = [
  { action: 'act-cute', label: '卖萌', status: '可爱一下～' },
  { action: 'wave', label: '招手', status: '嗨～看到你啦！' },
  { action: 'dance', label: '跳舞', status: '跟着节奏跳起来～' },
  { action: 'cheer', label: '加油', status: '一起加油！' },
  { action: 'give-flowers', label: '送花', status: '送你一束花！' },
  { action: 'anniversary', label: '纪念', status: '这是给你的纪念礼物！' },
  { action: 'handsome', label: '耍帅', status: '今天也很帅气！' },
  { action: 'walk-dog', label: '遛狗', status: '一起遛狗去～' },
];

function frameKey(action: PetAction, index: number): string {
  return `pet-${action}-${index.toString().padStart(3, '0')}`;
}

export class PetScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Graphics;
  private pet!: Phaser.GameObjects.Sprite;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private state: PetState = 'idle';
  private nextActionAt = 0;
  private nextThinkingAt = 0;
  private walkTargetX = 0;
  private walkDirection = 1;
  private walkSpeed = 40;

  private pointerDownAt = 0;
  private pointerDownPosition = new Phaser.Math.Vector2();
  private hasDragged = false;
  private activeTapPointerId: number | null = null;
  private pointerIsDown = false;
  private lastAcceptedTapAt = Number.NEGATIVE_INFINITY;
  private longPressTriggered = false;
  private longPressTimer?: Phaser.Time.TimerEvent;
  private groundPointerId: number | null = null;
  private groundPointerDownAt = 0;
  private groundPointerDownPosition = new Phaser.Math.Vector2();
  private actionWheel?: Phaser.GameObjects.Container;
  private interactionLocked = false;
  private clickCount = 0;
  private clickTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('PetScene');
  }

  preload(): void {
    (Object.entries(ACTIONS) as [PetAction, (typeof ACTIONS)[PetAction]][]).forEach(([action, config]) => {
      for (let index = 0; index < config.frames; index += 1) {
        const filename = `${index.toString().padStart(3, '0')}.png`;
        const folder = config.folder ?? action;
        this.load.image(frameKey(action, index), `${import.meta.env.BASE_URL}assets/actions/${folder}/${filename}`);
      }
    });
  }

  create(): void {
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
      .text(this.scale.width / 2, this.scale.height - 34, '点击地面移动 · 长按打开动作轮盘', {
        color: '#8d6071',
        fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
        fontSize: '14px',
      })
      .setOrigin(0.5, 1)
      .setDepth(20);

    this.pet = this.add
      .sprite(this.scale.width / 2, this.getFloorY() + 12, frameKey('idle', 0))
      .setOrigin(0.5, 1)
      .setScale(this.getPetScale())
      .setDepth(10)
      .setInteractive({ cursor: 'pointer' });

    this.pet.play('pet-idle');
    this.input.dragDistanceThreshold = 10;
    this.input.dragTimeThreshold = 10_000;
    this.input.setDraggable(this.pet);
    this.configureInput();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleScenePointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handleScenePointerUp, this);
    this.scheduleIdle(this.time.now + 2200);
    this.scheduleNextThinking(this.time.now);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleScenePointerDown, this);
      this.input.off(Phaser.Input.Events.POINTER_UP, this.handleScenePointerUp, this);
      this.clickTimer?.remove(false);
      this.longPressTimer?.remove(false);
      this.actionWheel?.destroy(true);
    });

    const loading = document.querySelector<HTMLDivElement>('#loading');
    loading?.classList.add('is-hidden');
    window.setTimeout(() => loading?.remove(), 250);
  }

  update(time: number, delta: number): void {
    if (
      !this.pet ||
      this.clickCount > 0 ||
      this.state === 'reaction' ||
      this.state === 'thinking' ||
      this.state === 'dragging'
    ) {
      return;
    }

    if (this.state === 'walking') {
      const nextX = this.pet.x + this.walkDirection * this.walkSpeed * (delta / 1000);
      const reachedTarget =
        (this.walkDirection > 0 && nextX >= this.walkTargetX) ||
        (this.walkDirection < 0 && nextX <= this.walkTargetX);

      if (reachedTarget) {
        this.pet.x = this.walkTargetX;
        this.scheduleIdle(time + Phaser.Math.Between(2400, 4800));
      } else {
        this.pet.x = nextX;
      }
      return;
    }

    if (time >= this.nextThinkingAt) {
      this.playOneShot('thinking', '让我想一想…', 'thinking');
      this.scheduleNextThinking(time);
      return;
    }

    if (time >= this.nextActionAt) {
      if (Math.random() < 0.55) {
        this.startWalking();
      } else {
        const activity = Phaser.Utils.Array.GetRandom(RANDOM_ACTIONS);
        this.playOneShot(activity.action, activity.status);
      }
    }
  }

  private createAnimations(): void {
    (Object.entries(ACTIONS) as [PetAction, (typeof ACTIONS)[PetAction]][]).forEach(([action, config]) => {
      const key = `pet-${action}`;
      if (this.anims.exists(key)) {
        return;
      }

      this.anims.create({
        key,
        frames: Array.from({ length: config.frames }, (_, index) => ({ key: frameKey(action, index) })),
        frameRate: config.frameRate,
        repeat: config.repeat ?? 0,
      });
    });
  }

  private configureInput(): void {
    this.pet.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.activeTapPointerId = pointer.id;
      this.pointerIsDown = true;
      this.longPressTriggered = false;
      this.pointerDownAt = pointer.downTime;
      this.pointerDownPosition.set(pointer.x, pointer.y);
      this.hasDragged = false;

      this.cancelLongPress();
      if (!this.interactionLocked && !this.actionWheel) {
        this.longPressTimer = this.time.delayedCall(LONG_PRESS_MS, () => {
          if (
            this.pointerIsDown &&
            this.activeTapPointerId === pointer.id &&
            !this.hasDragged
          ) {
            this.longPressTriggered = true;
            this.openActionWheel();
          }
        });
      }
    });

    this.pet.on(Phaser.Input.Events.DRAG_START, () => {
      this.cancelLongPress();
      this.hasDragged = true;
      this.pointerIsDown = false;
      this.activeTapPointerId = null;
      this.clearPendingClicks();
      this.cancelOneShot();
      this.state = 'dragging';
      this.pet.stop();
      this.pet.setTexture(frameKey('idle', 0));
      this.statusText.setText('要带我去哪里呀？');
    });

    this.pet.on(
      Phaser.Input.Events.DRAG,
      (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        const marginX = this.pet.displayWidth * 0.42;
        const minY = 115 + this.pet.displayHeight * 0.7;
        this.pet.x = Phaser.Math.Clamp(dragX, marginX, this.scale.width - marginX);
        this.pet.y = Phaser.Math.Clamp(dragY + this.pet.displayHeight * 0.5, minY, this.getFloorY() + 20);
      },
    );

    this.pet.on(Phaser.Input.Events.DRAG_END, () => {
      this.hasDragged = true;
      this.state = 'dragging';
      this.tweens.add({
        targets: this.pet,
        y: this.getFloorY() + 12,
        duration: 260,
        ease: 'Bounce.Out',
        onComplete: () => {
          this.statusText.setText('这里也不错～');
          this.scheduleIdle(this.time.now + 1600);
        },
      });
    });

    this.pet.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerIsDown || pointer.id !== this.activeTapPointerId) {
        return;
      }

      this.cancelLongPress();
      this.pointerIsDown = false;
      this.activeTapPointerId = null;
      const moved = Phaser.Math.Distance.Between(
        this.pointerDownPosition.x,
        this.pointerDownPosition.y,
        pointer.x,
        pointer.y,
      );
      const heldFor = pointer.upTime - this.pointerDownAt;

      if (this.longPressTriggered) {
        this.longPressTriggered = false;
        return;
      }

      if (!this.hasDragged && moved < 12 && heldFor < 450) {
        this.registerClick(pointer.upTime);
      }
    });
  }

  private handleScenePointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void {
    this.groundPointerId = null;

    if (this.actionWheel) {
      if (currentlyOver.length === 0) {
        this.closeActionWheel(true);
      }
      return;
    }

    if (currentlyOver.length > 0 || pointer.y < this.getFloorY() - 24) {
      return;
    }

    this.groundPointerId = pointer.id;
    this.groundPointerDownAt = pointer.downTime;
    this.groundPointerDownPosition.set(pointer.x, pointer.y);
  }

  private handleScenePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.groundPointerId) {
      return;
    }

    this.groundPointerId = null;
    const moved = Phaser.Math.Distance.Between(
      this.groundPointerDownPosition.x,
      this.groundPointerDownPosition.y,
      pointer.x,
      pointer.y,
    );
    const heldFor = pointer.upTime - this.groundPointerDownAt;

    if (moved < 12 && heldFor < 450 && !this.interactionLocked) {
      this.startWalking(pointer.x, false);
    }
  }

  private cancelLongPress(): void {
    this.longPressTimer?.remove(false);
    this.longPressTimer = undefined;
  }

  private openActionWheel(): void {
    if (this.actionWheel || this.interactionLocked) {
      return;
    }

    this.clearPendingClicks();
    this.cancelOneShot();
    this.state = 'reaction';
    this.interactionLocked = true;
    this.input.setDraggable(this.pet, false);
    this.pet.stop();
    this.pet.setTexture(frameKey('idle', 0));

    const radius = 92;
    const edge = radius + 31;
    const centerX = Phaser.Math.Clamp(this.pet.x, edge, Math.max(edge, this.scale.width - edge));
    const desiredCenterY = this.pet.y - this.pet.displayHeight * 0.46;
    const centerY = Phaser.Math.Clamp(desiredCenterY, 180, Math.max(180, this.scale.height - edge));
    const wheel = this.add.container(centerX, centerY).setDepth(50);

    const backdrop = this.add
      .circle(0, 0, radius + 29, 0xfff8fb, 0.96)
      .setStrokeStyle(3, 0xf1b8cc, 1);
    wheel.add(backdrop);

    ACTION_WHEEL_ITEMS.forEach((item, index) => {
      const angle = Phaser.Math.DegToRad(-90 + index * (360 / ACTION_WHEEL_ITEMS.length));
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const buttonCircle = this.add.circle(0, 0, 27, 0xf7c8d8, 1).setStrokeStyle(2, 0xe98eac, 1);
      const buttonLabel = this.add
        .text(0, 0, item.label, {
          color: '#74485a',
          fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          align: 'center',
        })
        .setOrigin(0.5);
      const button = this.add
        .container(x, y, [buttonCircle, buttonLabel])
        .setSize(56, 56)
        .setInteractive({ useHandCursor: true });
      button.on(Phaser.Input.Events.POINTER_UP, () => this.selectWheelAction(item));
      wheel.add(button);
    });

    const centerLabel = this.add
      .text(0, 0, '选择\n动作', {
        color: '#9c5a73',
        fontFamily: 'ui-rounded, "PingFang SC", sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    wheel.add(centerLabel);

    this.actionWheel = wheel;
    this.statusText.setText('选择一个动作吧～');
  }

  private selectWheelAction(item: (typeof ACTION_WHEEL_ITEMS)[number]): void {
    this.closeActionWheel(false);
    if (item.action === 'walk-dog') {
      this.startWalking(undefined, true);
    } else {
      this.playOneShot(item.action, item.status);
    }
  }

  private closeActionWheel(resumeIdle: boolean): void {
    if (!this.actionWheel) {
      return;
    }

    this.actionWheel.destroy(true);
    this.actionWheel = undefined;
    this.input.setDraggable(this.pet, true);
    this.interactionLocked = false;
    if (resumeIdle) {
      this.statusText.setText('想做什么都可以～');
      this.scheduleIdle(this.time.now + 1400);
    }
  }

  private registerClick(tapAt: number): void {
    if (this.interactionLocked) {
      return;
    }

    // Mobile browsers can expose one physical touch through duplicate pointer
    // events. Ignore only near-simultaneous duplicates, not real rapid taps.
    if (tapAt - this.lastAcceptedTapAt < DUPLICATE_TAP_GUARD_MS) {
      return;
    }
    this.lastAcceptedTapAt = tapAt;

    this.clickCount += 1;
    this.clickTimer?.remove(false);

    if (this.clickCount >= 3) {
      this.commitClickSequence();
      return;
    }

    this.clickTimer = this.time.delayedCall(CLICK_WINDOW_MS, () => this.commitClickSequence());
  }

  private commitClickSequence(): void {
    const clicks = Math.min(this.clickCount, 3);
    this.clearPendingClicks();

    if (clicks === 1) {
      this.playOneShot('sleep', '困困了，睡一会儿…');
    } else if (clicks === 2) {
      this.playOneShot('sorry', '对不起嘛，不要生气～');
    } else if (clicks === 3) {
      this.playOneShot('love', '最喜欢你啦！');
      this.spawnHearts();
    }
  }

  private clearPendingClicks(): void {
    this.clickTimer?.remove(false);
    this.clickTimer = undefined;
    this.clickCount = 0;
  }

  private playOneShot(
    action: Exclude<PetAction, 'idle' | 'walk-left' | 'walk-right' | 'walk-dog'>,
    status: string,
    state: PetState = 'reaction',
  ): void {
    if (this.interactionLocked) {
      return;
    }

    this.interactionLocked = true;
    this.state = state;
    this.tweens.killTweensOf(this.pet);
    this.pet.play(`pet-${action}`, true);
    this.statusText.setText(status);
    this.pet.once(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleOneShotComplete, this);
  }

  private handleOneShotComplete(): void {
    this.interactionLocked = false;
    this.scheduleIdle(this.time.now + Phaser.Math.Between(1800, 3600));
  }

  private cancelOneShot(): void {
    this.pet.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.handleOneShotComplete, this);
    this.interactionLocked = false;
    this.tweens.killTweensOf(this.pet);
  }

  private spawnHearts(): void {
    [-34, 0, 34].forEach((offsetX, index) => {
      const heart = this.add
        .text(this.pet.x + offsetX, this.pet.y - this.pet.displayHeight * 0.76, index === 1 ? '♥' : '♡', {
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
        y: heart.y - 65 - index * 8,
        x: heart.x + (index - 1) * 10,
        duration: 760,
        delay: index * 90,
        ease: 'Sine.Out',
        onComplete: () => heart.destroy(),
      });
    });
  }

  private startWalking(requestedTargetX?: number, forceDog = false): void {
    if (this.interactionLocked || this.actionWheel) {
      return;
    }

    const hasRequestedTarget = requestedTargetX !== undefined;
    const useDog = forceDog || (!hasRequestedTarget && Math.random() < 0.25);
    const margin = this.pet.displayWidth * (useDog ? 0.43 : 0.34);
    const minX = margin;
    const maxX = Math.max(minX + 1, this.scale.width - margin);
    let targetX = hasRequestedTarget
      ? Phaser.Math.Clamp(requestedTargetX, minX, maxX)
      : Phaser.Math.Between(Math.ceil(minX), Math.floor(maxX));

    if (!hasRequestedTarget && Math.abs(targetX - this.pet.x) < 80) {
      targetX = this.pet.x < this.scale.width / 2 ? maxX : minX;
    }

    if (hasRequestedTarget && Math.abs(targetX - this.pet.x) < 6) {
      this.statusText.setText('我已经在这里啦～');
      this.scheduleIdle(this.time.now + 1200);
      return;
    }

    this.walkTargetX = targetX;
    this.walkDirection = targetX >= this.pet.x ? 1 : -1;
    if (useDog) {
      this.pet.setFlipX(this.walkDirection < 0);
      this.pet.play('pet-walk-dog', true);
      this.statusText.setText('一起遛狗去～');
    } else {
      this.pet.setFlipX(false);
      this.pet.play(this.walkDirection > 0 ? 'pet-walk-right' : 'pet-walk-left', true);
      this.statusText.setText(Phaser.Utils.Array.GetRandom(['去那边看看', '散散步～', '哒哒哒…']));
    }
    this.state = 'walking';
  }

  private scheduleIdle(nextActionAt: number): void {
    this.state = 'idle';
    this.interactionLocked = false;
    this.pet.y = this.getFloorY() + 12;
    this.pet.setFlipX(false);
    this.pet.play('pet-idle', true);
    this.nextActionAt = nextActionAt;
  }

  private scheduleNextThinking(from: number): void {
    this.nextThinkingAt = from + Phaser.Math.Between(14_000, 24_000);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    const { width, height } = gameSize;
    if (this.actionWheel) {
      this.closeActionWheel(true);
    }
    this.drawRoom(width, height);
    this.titleText.setPosition(width / 2, 30);
    this.statusText.setPosition(width / 2, 68);
    this.hintText.setPosition(width / 2, height - 34);

    this.pet.setScale(this.getPetScale());
    const margin = this.pet.displayWidth * 0.48;
    this.pet.x = Phaser.Math.Clamp(this.pet.x, margin, Math.max(margin, width - margin));
    this.pet.y = this.getFloorY() + 12;
  }

  private drawRoom(width: number, height: number): void {
    if (!this.background) return;

    const floorY = height * 0.72;
    this.background.clear();
    this.background.fillStyle(0xfff1f6, 1).fillRect(0, 0, width, floorY);
    this.background.fillStyle(0xf4cfbf, 1).fillRect(0, floorY, width, height - floorY);
    this.background.fillStyle(0xe8b8a8, 1).fillRect(0, floorY, width, 5);

    this.background.fillStyle(0xf8cedd, 0.5);
    for (let y = 135; y < floorY - 40; y += 70) {
      for (let x = 28 + ((y / 70) % 2) * 24; x < width; x += 82) {
        this.background.fillRect(Math.round(x), Math.round(y), 5, 5);
        this.background.fillRect(Math.round(x + 5), Math.round(y + 5), 5, 5);
      }
    }

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

    const shelfX = width * 0.7;
    const shelfY = height * 0.34;
    this.background.fillStyle(0xc68e7b, 1).fillRect(shelfX - 45, shelfY + 45, 110, 10);
    this.background.fillStyle(0xe1899e, 1).fillRect(shelfX - 21, shelfY + 17, 42, 30);
    this.background.fillStyle(0x67a879, 1).fillRect(shelfX - 3, shelfY - 17, 7, 36);
    this.background.fillStyle(0x7abb88, 1).fillRect(shelfX - 22, shelfY - 18, 20, 13);
    this.background.fillStyle(0x589e70, 1).fillRect(shelfX + 4, shelfY - 28, 22, 14);

    const rugWidth = Phaser.Math.Clamp(width * 0.58, 220, 520);
    this.background.fillStyle(0xe9a9bc, 1).fillEllipse(width / 2, floorY + (height - floorY) * 0.56, rugWidth, Math.min(105, height * 0.13));
    this.background.fillStyle(0xf8d3df, 1).fillEllipse(width / 2, floorY + (height - floorY) * 0.54, rugWidth * 0.78, Math.min(62, height * 0.075));
    this.background.setDepth(0);
  }

  private getPetScale(): number {
    const widthScale = this.scale.width / 390;
    const heightScale = this.scale.height / 844;
    return Phaser.Math.Clamp(Math.min(widthScale, heightScale) * 0.52, 0.45, 0.64);
  }

  private getFloorY(): number {
    return this.scale.height * 0.72;
  }
}
