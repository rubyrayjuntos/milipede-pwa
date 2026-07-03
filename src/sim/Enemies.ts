import { GRID_COLS, GRID_ROWS, PLAYER_ZONE_START_ROW } from "../core/constants";
import { RNG } from "../core/RNG";
import type { Enemy, EnemyKind } from "./types";

export interface EnemyEvents {
  spawnMushroom(col: number, row: number): void;
  poisonMushroom(col: number, row: number): void;
  eatMushroom(col: number, row: number): void;
  shiftGrid(delta: 1 | -1): void;
  triggerTimeDilation(): void;
  score(points: number): void;
}

let nextEnemyId = 0;

function enemyKillPoints(enemy: Enemy, distanceToPlayer: number): number {
  switch (enemy.kind) {
    case "spider":
      return Math.round(1200 * Math.max(0.1, 1 - distanceToPlayer / GRID_COLS));
    case "inchworm":
      return 300;
    case "dragonfly":
    case "mosquito":
      return 200;
    default:
      return 100;
  }
}

export class EnemySystem {
  enemies: Enemy[] = [];

  spawn(kind: EnemyKind, rng: RNG): Enemy {
    const e = this.build(kind, rng);
    this.enemies.push(e);
    return e;
  }

  private build(kind: EnemyKind, rng: RNG): Enemy {
    const base: Enemy = {
      id: nextEnemyId++,
      kind,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 1,
      alive: true,
      age: 0,
      data: {},
    };
    switch (kind) {
      case "spider": {
        base.x = rng.int(1, GRID_COLS - 2);
        base.y = rng.range(PLAYER_ZONE_START_ROW + 1, GRID_ROWS - 1);
        base.vx = rng.pick([-1, 1]) * rng.range(3, 5);
        base.data = { jumpTimer: 0, jumpPhase: 0 };
        return base;
      }
      case "earwig": {
        const fromLeft = rng.next() < 0.5;
        base.x = fromLeft ? -1 : GRID_COLS;
        base.y = rng.int(0, PLAYER_ZONE_START_ROW - 1);
        base.vx = (fromLeft ? 1 : -1) * 4;
        return base;
      }
      case "bee": {
        base.x = rng.int(0, GRID_COLS - 1);
        base.y = -1;
        base.vy = 5;
        base.hp = 2;
        base.data = { lastTrailRow: -1 };
        return base;
      }
      case "inchworm": {
        base.x = rng.int(0, GRID_COLS - 1);
        base.y = rng.int(GRID_ROWS / 3, (2 * GRID_ROWS) / 3);
        base.vx = rng.pick([-1, 1]) * 1.2;
        return base;
      }
      case "beetle": {
        const fromLeft = rng.next() < 0.5;
        base.x = fromLeft ? -1 : GRID_COLS;
        base.y = rng.int(PLAYER_ZONE_START_ROW, GRID_ROWS - 1);
        base.vx = (fromLeft ? 1 : -1) * 3.5;
        return base;
      }
      case "dragonfly": {
        base.x = rng.int(0, GRID_COLS - 1);
        base.y = -1;
        base.vy = 3;
        base.data = { phase: rng.range(0, Math.PI * 2), amp: rng.range(1.5, 3) };
        return base;
      }
      case "mosquito": {
        base.x = rng.int(0, GRID_COLS - 1);
        base.y = 0;
        base.vx = rng.pick([-1, 1]) * 3;
        base.vy = 2.5;
        return base;
      }
    }
  }

  tick(dt: number, rng: RNG, events: EnemyEvents): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.age += dt;

      switch (e.kind) {
        case "spider": {
          e.data.jumpTimer -= dt;
          if (e.data.jumpTimer <= 0) {
            e.data.jumpTimer = rng.range(0.4, 0.9);
            e.vx = rng.pick([-1, 1]) * rng.range(2, 5);
            e.data.jumpPhase = 0;
          }
          e.data.jumpPhase += dt * 4;
          e.x += e.vx * dt;
          e.y += Math.sin(e.data.jumpPhase) * dt * 2;
          e.y = Math.max(PLAYER_ZONE_START_ROW, Math.min(GRID_ROWS - 1, e.y));
          if (e.x < 0 || e.x > GRID_COLS - 1) e.vx *= -1;
          events.eatMushroom(Math.round(e.x), Math.round(e.y));
          break;
        }
        case "earwig": {
          e.x += e.vx * dt;
          const col = Math.round(e.x);
          if (col >= 0 && col < GRID_COLS) events.poisonMushroom(col, Math.round(e.y));
          if (e.x < -2 || e.x > GRID_COLS + 2) e.alive = false;
          break;
        }
        case "bee": {
          e.y += e.vy * dt;
          const row = Math.floor(e.y);
          if (row !== e.data.lastTrailRow && row >= 0 && row < GRID_ROWS) {
            e.data.lastTrailRow = row;
            events.spawnMushroom(Math.round(e.x), row);
          }
          if (e.y > GRID_ROWS) e.alive = false;
          break;
        }
        case "inchworm": {
          e.x += e.vx * dt;
          if (e.x < 0 || e.x > GRID_COLS - 1) e.vx *= -1;
          break;
        }
        case "beetle": {
          e.x += e.vx * dt;
          if (e.x < -2 || e.x > GRID_COLS + 2) e.alive = false;
          break;
        }
        case "dragonfly": {
          e.y += e.vy * dt;
          e.data.phase += dt * 3;
          e.x += Math.sin(e.data.phase) * e.data.amp * dt;
          e.x = Math.max(0, Math.min(GRID_COLS - 1, e.x));
          if (rng.next() < 0.15 * dt * 10) {
            events.spawnMushroom(Math.round(e.x), Math.round(e.y));
          }
          if (e.y > GRID_ROWS) e.alive = false;
          break;
        }
        case "mosquito": {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.x < 0 || e.x > GRID_COLS - 1) e.vx *= -1;
          if (e.y > GRID_ROWS) e.alive = false;
          break;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  hit(enemy: Enemy, distanceToPlayer: number, events: EnemyEvents, scoreMultiplier = 1): void {
    enemy.hp--;
    if (enemy.hp > 0) return;
    this.kill(enemy, distanceToPlayer, events, scoreMultiplier);
  }

  /** Used both for a normal projectile kill and for a DDT blast kill (which bypasses hp). */
  kill(enemy: Enemy, distanceToPlayer: number, events: EnemyEvents, scoreMultiplier = 1): void {
    enemy.alive = false;
    events.score(Math.round(enemyKillPoints(enemy, distanceToPlayer) * scoreMultiplier));
    if (enemy.kind === "inchworm") events.triggerTimeDilation();
    if (enemy.kind === "beetle") events.shiftGrid(1);
    if (enemy.kind === "mosquito") events.shiftGrid(-1);
  }

  clear(): void {
    this.enemies = [];
  }
}
