import type { InputState } from "../sim/World";

const SENSITIVITY = 0.045;
const DOUBLE_TAP_WINDOW = 320; // ms

interface Touch2 {
  id: number;
  x: number;
  y: number;
}

/**
 * Dual-thumb scheme, decoupled movement from action per spec section 2:
 *  - Left half: relative virtual trackball. Origin re-centers wherever the thumb lands;
 *    velocity comes from frame-to-frame delta run through an acceleration curve, so
 *    small swipes give precision and fast swipes give sweeping evasions.
 *  - Right half: hold-to-fire (engine auto-requeues shots once the active one resolves,
 *    see ProjectileSystem) and a double-tap gesture that detonates the nearest DDT bomb.
 */
export class TouchControls {
  private left: Touch2 | null = null;
  private right: Touch2 | null = null;
  private lastRightTapTime = 0;

  readonly state: InputState = { dx: 0, dy: 0, firing: false, detonateRequested: false };

  constructor(el: HTMLElement) {
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", this.onTouchEnd, { passive: false });

    // Desktop/dev fallback: mouse-left-drag = move, mouse-right/space = fire.
    el.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private isLeftZone(x: number): boolean {
    return x < window.innerWidth / 2;
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.isLeftZone(t.clientX)) {
        if (!this.left) this.left = { id: t.identifier, x: t.clientX, y: t.clientY };
      } else {
        if (!this.right) {
          this.right = { id: t.identifier, x: t.clientX, y: t.clientY };
          this.state.firing = true;
          const now = performance.now();
          if (now - this.lastRightTapTime < DOUBLE_TAP_WINDOW) {
            this.state.detonateRequested = true;
          }
          this.lastRightTapTime = now;
        }
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.left && t.identifier === this.left.id) {
        const dx = t.clientX - this.left.x;
        const dy = t.clientY - this.left.y;
        this.applyDelta(dx, dy);
        this.left.x = t.clientX;
        this.left.y = t.clientY;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (this.left && t.identifier === this.left.id) this.left = null;
      if (this.right && t.identifier === this.right.id) {
        this.right = null;
        this.state.firing = false;
      }
    }
  };

  private applyDelta(dx: number, dy: number): void {
    const speed = Math.hypot(dx, dy);
    // Exponential acceleration curve: fast swipes gain disproportionate velocity,
    // simulating trackball momentum while preserving fine control at low speeds.
    const accel = 1 + Math.pow(speed / 12, 1.6);
    this.state.dx += dx * SENSITIVITY * accel;
    this.state.dy += dy * SENSITIVITY * accel;
  }

  // --- desktop fallback ---
  private mouseDown = false;
  private mousePrev = { x: 0, y: 0 };
  private onMouseDown = (e: MouseEvent): void => {
    if (this.isLeftZone(e.clientX)) {
      this.mouseDown = true;
      this.mousePrev = { x: e.clientX, y: e.clientY };
    } else {
      this.state.firing = true;
    }
  };
  private onMouseMove = (e: MouseEvent): void => {
    if (!this.mouseDown) return;
    this.applyDelta(e.clientX - this.mousePrev.x, e.clientY - this.mousePrev.y);
    this.mousePrev = { x: e.clientX, y: e.clientY };
  };
  private onMouseUp = (): void => {
    this.mouseDown = false;
    this.state.firing = false;
  };
  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "Space") this.state.detonateRequested = true;
  };
  private onKeyUp = (): void => {};

  /** Call once per tick after the sim consumes dx/dy/detonateRequested (they're edge/accumulator values). */
  consumeFrame(): InputState {
    const snapshot = { ...this.state };
    this.state.dx = 0;
    this.state.dy = 0;
    this.state.detonateRequested = false;
    return snapshot;
  }
}
