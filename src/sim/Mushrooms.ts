import { GRID_COLS, GRID_ROWS, MUSHROOM_HITS_TO_KILL, SCORING } from "../core/constants";
import { RNG } from "../core/RNG";
import type { Mushroom } from "./types";

export class MushroomField {
  /** grid[row][col] -> Mushroom | null */
  readonly grid: (Mushroom | null)[][];

  constructor() {
    this.grid = Array.from({ length: GRID_ROWS }, () =>
      new Array<Mushroom | null>(GRID_COLS).fill(null),
    );
  }

  at(col: number, row: number): Mushroom | null {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return this.grid[row][col];
  }

  spawn(col: number, row: number, poisoned = false): void {
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    if (this.grid[row][col]) return;
    this.grid[row][col] = { col, row, hits: 0, poisoned, alive: true };
  }

  /** Seed an initial field with roughly `density` fraction of cells filled, avoiding the player zone. */
  seedRandom(rng: RNG, density: number, avoidBelowRow: number): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      if (row >= avoidBelowRow) continue;
      for (let col = 0; col < GRID_COLS; col++) {
        if (rng.next() < density) this.spawn(col, row);
      }
    }
  }

  poison(col: number, row: number): void {
    const m = this.at(col, row);
    if (m) m.poisoned = true;
  }

  /** Returns true if the mushroom died from this hit. Awards score via callback. */
  hit(col: number, row: number, onScore: (points: number) => void): boolean {
    const m = this.grid[row][col];
    if (!m || !m.alive) return false;
    m.hits++;
    if (m.hits >= MUSHROOM_HITS_TO_KILL) {
      m.alive = false;
      this.grid[row][col] = null;
      onScore(SCORING.mushroomDestroyed);
      return true;
    }
    return false;
  }

  /** Damage scale factor used for render (1.0 = full health, 0 = destroyed). */
  scaleFor(m: Mushroom): number {
    return 1 - m.hits * 0.25;
  }

  /** Player-death reset: heal all damaged/poisoned mushrooms, award restoration points. */
  restoreAll(onScore: (points: number) => void): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const m = this.grid[row][col];
        if (m && (m.hits > 0 || m.poisoned)) {
          m.hits = 0;
          m.poisoned = false;
          onScore(SCORING.mushroomRestored);
        }
      }
    }
  }

  /** End-of-wave Conway-style regeneration: overcrowded cells die, sparse-but-adjacent cells spawn. */
  regenerate(rng: RNG): void {
    const neighborCount = (col: number, row: number): number => {
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          if (this.at(col + dc, row + dr)) n++;
        }
      }
      return n;
    };

    const toKill: [number, number][] = [];
    const toSpawn: [number, number][] = [];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const occupied = !!this.at(col, row);
        const n = neighborCount(col, row);
        if (occupied && n >= 6) toKill.push([col, row]);
        else if (!occupied && n >= 2 && n <= 3 && rng.next() < 0.5) toSpawn.push([col, row]);
      }
    }

    for (const [col, row] of toKill) this.grid[row][col] = null;
    for (const [col, row] of toSpawn) this.spawn(col, row);
  }

  forEach(fn: (m: Mushroom) => void): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const m = this.grid[row][col];
        if (m) fn(m);
      }
    }
  }

  /** Shift the whole field one row down/up (Beetle/Mosquito destruction effect). Returns entities that fell off. */
  shiftRows(delta: 1 | -1): void {
    const next: (Mushroom | null)[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array<Mushroom | null>(GRID_COLS).fill(null),
    );
    for (let row = 0; row < GRID_ROWS; row++) {
      const newRow = row + delta;
      if (newRow < 0 || newRow >= GRID_ROWS) continue;
      for (let col = 0; col < GRID_COLS; col++) {
        const m = this.grid[row][col];
        if (m) {
          m.row = newRow;
          next[newRow][col] = m;
        }
      }
    }
    for (let row = 0; row < GRID_ROWS; row++) this.grid[row] = next[row];
  }
}
