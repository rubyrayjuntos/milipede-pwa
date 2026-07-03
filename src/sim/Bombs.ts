import { GRID_COLS, PLAYER_ZONE_START_ROW } from "../core/constants";
import { RNG } from "../core/RNG";
import type { Bomb } from "./types";

const MAX_BOMBS = 4;
const BLAST_RADIUS = 2.25; // grid cells
const BLAST_LIFETIME = 0.35; // seconds the blast visual/hit-window stays active

export class BombSystem {
  bombs: Bomb[] = [];
  private nextId = 0;

  get count(): number {
    return this.bombs.filter((b) => b.alive).length;
  }

  maybeSpawn(rng: RNG): void {
    if (this.count >= MAX_BOMBS) return;
    const col = rng.int(1, GRID_COLS - 2);
    const row = rng.int(1, PLAYER_ZONE_START_ROW - 2);
    this.bombs.push({ id: this.nextId++, col, row, alive: true, detonating: false, blastTimer: 0 });
  }

  tick(dt: number, onExpire: (bomb: Bomb) => void): void {
    for (const bomb of this.bombs) {
      if (!bomb.detonating) continue;
      bomb.blastTimer -= dt;
      if (bomb.blastTimer <= 0) {
        bomb.alive = false;
        onExpire(bomb);
      }
    }
    this.bombs = this.bombs.filter((b) => b.alive || b.detonating);
  }

  detonate(bomb: Bomb): void {
    if (bomb.detonating) return;
    bomb.detonating = true;
    bomb.blastTimer = BLAST_LIFETIME;
  }

  /** Nearest live, non-detonating bomb within radius of (col,row), or null. */
  findNear(col: number, row: number, radius: number): Bomb | null {
    let best: Bomb | null = null;
    let bestDist = Infinity;
    for (const b of this.bombs) {
      if (!b.alive || b.detonating) continue;
      const d = Math.hypot(b.col - col, b.row - row);
      if (d <= radius && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  isWithinBlast(bomb: Bomb, col: number, row: number): boolean {
    return Math.hypot(bomb.col - col, bomb.row - row) <= BLAST_RADIUS;
  }

  get blastRadius(): number {
    return BLAST_RADIUS;
  }

  clear(): void {
    this.bombs = [];
  }
}
