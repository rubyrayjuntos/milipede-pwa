import { GRID_COLS, GRID_ROWS, PLAYER_ZONE_START_ROW, TICK_DT } from "../core/constants";
import { RNG } from "../core/RNG";
import { MushroomField } from "./Mushrooms";
import type { MillipedeChain, MillipedeSegment } from "./types";

const PLUNGE_SPEED = 14; // rows/sec while poison-plunging
const PENALTY_SPAWN_INTERVAL = 3.5; // seconds between reinforcement head spawns while breached

export class MillipedeSystem {
  chains: MillipedeChain[] = [];
  private nextSegId = 0;
  private nextChainId = 0;
  /** per-chain follow-the-leader position history, keyed by chain id */
  private history = new Map<number, { x: number; row: number }[]>();

  spawnChain(headCol: number, length: number, direction: 1 | -1, speed: number): MillipedeChain {
    const segments: MillipedeSegment[] = [];
    for (let i = 0; i < length; i++) {
      segments.push({
        id: this.nextSegId++,
        col: headCol,
        row: 0,
        x: headCol,
        isHead: i === 0,
        chainId: this.nextChainId,
      });
    }
    const chain: MillipedeChain = {
      id: this.nextChainId++,
      segments,
      direction,
      speed,
      state: "traversing",
      penaltyTimer: 0,
    };
    this.chains.push(chain);
    this.history.set(chain.id, []);
    return chain;
  }

  get totalSegments(): number {
    return this.chains.reduce((n, c) => n + c.segments.length, 0);
  }

  private stepsPerCell(chain: MillipedeChain): number {
    return Math.max(1, Math.round(1 / chain.speed / TICK_DT));
  }

  tick(
    dt: number,
    mushrooms: MushroomField,
    rng: RNG,
    onScore: (points: number) => void,
    onSpawnMushroomFromSegment: (col: number, row: number) => void,
  ): void {
    for (const chain of this.chains) {
      const head = chain.segments[0];

      if (chain.state === "plunging") {
        head.row = Math.min(GRID_ROWS - 1, head.row + PLUNGE_SPEED * dt);
        if (head.row >= GRID_ROWS - 1) {
          head.row = GRID_ROWS - 1;
          chain.state = head.row >= PLAYER_ZONE_START_ROW ? "penaltyZone" : "traversing";
        }
      } else if (chain.state === "penaltyZone") {
        chain.penaltyTimer -= dt;
        // Erratic bounce confined to the player's lower band.
        const nextX = head.x + chain.direction * chain.speed * dt;
        const nextCol = Math.floor(nextX);
        if (nextCol < 0 || nextCol >= GRID_COLS || mushrooms.at(nextCol, Math.round(head.row))) {
          chain.direction = (chain.direction * -1) as 1 | -1;
        } else {
          head.x = nextX;
        }
        if (rng.next() < 0.02) chain.direction = (chain.direction * -1) as 1 | -1;
      } else {
        const nextX = head.x + chain.direction * chain.speed * dt;
        const nextCol = chain.direction > 0 ? Math.floor(nextX + 1) : Math.floor(nextX);
        const row = Math.round(head.row);
        const blockedByWall = nextCol < 0 || nextCol >= GRID_COLS;
        const blockingMushroom = blockedByWall ? null : mushrooms.at(nextCol, row);

        if (blockedByWall || blockingMushroom) {
          if (blockingMushroom?.poisoned) {
            chain.state = "plunging";
          } else {
            chain.direction = (chain.direction * -1) as 1 | -1;
            head.row = row + 1;
            if (head.row >= GRID_ROWS) head.row = GRID_ROWS - 1;
            if (head.row >= PLAYER_ZONE_START_ROW) {
              chain.state = "penaltyZone";
              chain.penaltyTimer = 0;
            }
          }
        } else {
          head.x = nextX;
        }
      }

      head.col = Math.round(head.x);

      // Follow-the-leader trail for body segments.
      const hist = this.history.get(chain.id)!;
      hist.unshift({ x: head.x, row: head.row });
      const stepsPerCell = this.stepsPerCell(chain);
      const maxLen = chain.segments.length * stepsPerCell + 2;
      if (hist.length > maxLen) hist.length = maxLen;

      for (let i = 1; i < chain.segments.length; i++) {
        const idx = Math.min(i * stepsPerCell, hist.length - 1);
        const sample = hist[idx] ?? hist[hist.length - 1];
        const seg = chain.segments[i];
        seg.x = sample.x;
        seg.row = sample.row;
        seg.col = Math.round(sample.x);
      }
    }

    // Penalty-zone reinforcement spawns.
    this.penaltySpawnAccumulator += dt;
    if (this.penaltySpawnAccumulator >= PENALTY_SPAWN_INTERVAL) {
      this.penaltySpawnAccumulator = 0;
      const breached = this.chains.some((c) => c.state === "penaltyZone");
      if (breached) {
        const fromLeft = rng.next() < 0.5;
        const row = rng.int(PLAYER_ZONE_START_ROW, GRID_ROWS - 1);
        this.spawnReinforcement(fromLeft ? 0 : GRID_COLS - 1, row, fromLeft ? 1 : -1);
      }
    }

    void onSpawnMushroomFromSegment;
    void onScore;
  }

  private penaltySpawnAccumulator = 0;

  private spawnReinforcement(col: number, row: number, direction: 1 | -1): void {
    const chain: MillipedeChain = {
      id: this.nextChainId++,
      segments: [
        {
          id: this.nextSegId++,
          col,
          row,
          x: col,
          isHead: true,
          chainId: -1,
        },
      ],
      direction,
      speed: 5,
      state: "penaltyZone",
      penaltyTimer: 0,
    };
    chain.segments[0].chainId = chain.id;
    this.chains.push(chain);
    this.history.set(chain.id, []);
  }

  /** Hit a specific segment (by chain + index). Handles fracture-into-two-chains logic. */
  hitSegment(
    chainId: number,
    segIndex: number,
    mushrooms: MushroomField,
    onScore: (points: number) => void,
  ): void {
    const chainIdx = this.chains.findIndex((c) => c.id === chainId);
    if (chainIdx === -1) return;
    const chain = this.chains[chainIdx];
    const seg = chain.segments[segIndex];
    if (!seg) return;

    mushrooms.spawn(seg.col, Math.round(seg.row));
    onScore(seg.isHead ? 100 : 10);

    const before = chain.segments.slice(0, segIndex);
    const after = chain.segments.slice(segIndex + 1);

    if (before.length === 0 && after.length === 0) {
      this.chains.splice(chainIdx, 1);
      this.history.delete(chain.id);
      return;
    }

    if (before.length === 0) {
      // Head destroyed: next segment promotes to head, chain continues unchanged in identity.
      after[0].isHead = true;
      chain.segments = after;
      return;
    }

    if (after.length === 0) {
      // Tail segment removed: chain simply shrinks.
      chain.segments = before;
      return;
    }

    // Middle segment destroyed: fracture into two independent chains.
    chain.segments = before;
    const newChain: MillipedeChain = {
      id: this.nextChainId++,
      segments: after,
      direction: chain.direction,
      speed: chain.speed,
      state: chain.state,
      penaltyTimer: chain.penaltyTimer,
    };
    after[0].isHead = true;
    for (const s of after) s.chainId = newChain.id;
    this.chains.push(newChain);
    this.history.set(newChain.id, [...(this.history.get(chain.id) ?? [])]);
  }

  /**
   * Destroys every segment within `radius` of (col,row) simultaneously (DDT blast).
   * Each contiguous surviving run of segments becomes its own chain, generalizing
   * the single-hit fracture logic to a multi-hit explosion.
   */
  blastHit(
    col: number,
    row: number,
    radius: number,
    onScore: (points: number) => void,
    scoreMultiplier: number,
  ): void {
    const nextChains: MillipedeChain[] = [];
    for (const chain of this.chains) {
      const runs: MillipedeSegment[][] = [];
      let run: MillipedeSegment[] = [];
      let firstRun = true;

      for (const seg of chain.segments) {
        const dist = Math.hypot(seg.col - col, seg.row - row);
        if (dist <= radius) {
          onScore(Math.round((seg.isHead ? 100 : 10) * scoreMultiplier));
          if (run.length > 0) {
            runs.push(run);
            run = [];
          }
        } else {
          run.push(seg);
        }
      }
      if (run.length > 0) runs.push(run);

      for (const survivors of runs) {
        survivors[0].isHead = true;
        const reuseOriginal = firstRun && survivors.length === chain.segments.length;
        const newChain: MillipedeChain = reuseOriginal
          ? chain
          : {
              id: this.nextChainId++,
              segments: survivors,
              direction: chain.direction,
              speed: chain.speed,
              state: chain.state,
              penaltyTimer: chain.penaltyTimer,
            };
        newChain.segments = survivors;
        for (const s of survivors) s.chainId = newChain.id;
        if (!this.history.has(newChain.id)) this.history.set(newChain.id, []);
        nextChains.push(newChain);
        firstRun = false;
      }
      if (runs.length === 0) this.history.delete(chain.id);
    }
    this.chains = nextChains;
  }

  removeChain(chainId: number): void {
    this.chains = this.chains.filter((c) => c.id !== chainId);
    this.history.delete(chainId);
  }

  clear(): void {
    this.chains = [];
    this.history.clear();
  }
}
