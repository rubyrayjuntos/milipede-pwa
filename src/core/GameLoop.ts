import { TICK_DT } from "./constants";

/**
 * Decouples simulation from render framerate. The render loop runs unbounded
 * (rAF, e.g. 120Hz), while `tick` fires at a constant 60Hz, so gameplay is
 * identical regardless of display refresh rate or frame-time jitter.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private running = false;
  private readonly maxFrameTime = 0.25; // clamp to avoid spiral-of-death after tab-switch
  private tick: (dt: number) => void;
  private render: (alpha: number) => void;

  constructor(tick: (dt: number) => void, render: (alpha: number) => void) {
    this.tick = tick;
    this.render = render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    let frameTime = (now - this.lastTime) / 1000;
    if (frameTime > this.maxFrameTime) frameTime = this.maxFrameTime;
    this.lastTime = now;
    this.accumulator += frameTime;

    while (this.accumulator >= TICK_DT) {
      this.tick(TICK_DT);
      this.accumulator -= TICK_DT;
    }

    const alpha = this.accumulator / TICK_DT;
    this.render(alpha);

    this.rafHandle = requestAnimationFrame(this.frame);
  };
}
