import { GRID_COLS, GRID_ROWS, PLAYER_ZONE_START_ROW, SCORING } from "../core/constants";
import { RNG } from "../core/RNG";
import { SpatialHash } from "../core/SpatialHash";
import { MushroomField } from "./Mushrooms";
import { MillipedeSystem } from "./Millipede";
import { BombSystem } from "./Bombs";
import { EnemySystem, type EnemyEvents } from "./Enemies";
import { ProjectileSystem } from "./Projectiles";
import { createPlayer, movePlayer } from "./Player";
import type { Bomb, EnemyKind, GameState } from "./types";

const SWARM_KINDS: EnemyKind[] = ["bee", "dragonfly", "mosquito"];
const SWARM_SCORE_INTERVAL = 6000;
const HIT_RADIUS = 0.55;
const PLAYER_DEATH_RADIUS = 0.6;

type HashEntry =
  | { type: "mushroom"; col: number; row: number }
  | { type: "segment"; chainId: number; index: number; col: number; row: number }
  | { type: "enemy"; id: number; x: number; y: number }
  | { type: "bomb"; id: number; col: number; row: number };

export interface WorldEvents {
  onScoreChange(score: number): void;
  onLivesChange(lives: number): void;
  onWaveChange(wave: number): void;
  onGameOver(finalScore: number): void;
  onSound(name: "laser" | "explosion" | "mushroomHit" | "enemyKilled" | "playerDeath" | "poison"): void;
}

export interface InputState {
  dx: number;
  dy: number;
  firing: boolean;
  detonateRequested: boolean;
}

export class World {
  state: GameState = "menu";
  mushrooms = new MushroomField();
  millipede = new MillipedeSystem();
  bombs = new BombSystem();
  enemies = new EnemySystem();
  projectiles = new ProjectileSystem();
  player = createPlayer();
  rng = new RNG(Date.now() >>> 0);
  private spatialHash = new SpatialHash<HashEntry>(1.5, 1.5, Math.ceil(GRID_COLS / 1.5) + 4);

  score = 0;
  wave = 1;
  timeDilationTimer = 0;

  swarmActive = false;
  swarmTimer = 0;
  swarmKind: EnemyKind = "bee";
  swarmCombo = 0;
  nextSwarmScore = SWARM_SCORE_INTERVAL;

  private enemySpawnTimer = 2;
  private bombMaintainTimer = 1;
  private events: WorldEvents;

  constructor(events: WorldEvents) {
    this.events = events;
  }

  start(): void {
    this.mushrooms = new MushroomField();
    this.mushrooms.seedRandom(this.rng, 0.22, PLAYER_ZONE_START_ROW);
    this.millipede.clear();
    this.bombs.clear();
    this.enemies.clear();
    this.projectiles.clear();
    this.player = createPlayer();
    this.score = 0;
    this.wave = 1;
    this.swarmActive = false;
    this.nextSwarmScore = SWARM_SCORE_INTERVAL;
    this.spawnWaveMillipede();
    this.state = "playing";
    this.events.onScoreChange(this.score);
    this.events.onLivesChange(this.player.lives);
    this.events.onWaveChange(this.wave);
  }

  private addScore(points: number): void {
    this.score += points;
    this.events.onScoreChange(this.score);
    if (this.score >= this.nextSwarmScore) {
      this.nextSwarmScore += SWARM_SCORE_INTERVAL;
      this.beginSwarm();
    }
  }

  private beginSwarm(): void {
    this.swarmActive = true;
    this.swarmTimer = 10;
    this.swarmKind = this.rng.pick(SWARM_KINDS);
    this.swarmCombo = 0;
  }

  private spawnWaveMillipede(): void {
    const length = Math.min(12, 8 + Math.floor(this.wave / 2));
    const speed = Math.min(10, 3 + this.wave * 0.4);
    this.millipede.spawnChain(Math.floor(GRID_COLS / 2), length, this.rng.pick([-1, 1]), speed);
  }

  tick(dt: number, input: InputState): void {
    if (this.state !== "playing") return;

    if (this.timeDilationTimer > 0) this.timeDilationTimer -= dt;
    const dilated = this.timeDilationTimer > 0 ? dt * 0.5 : dt;

    movePlayer(this.player, input.dx, input.dy);

    if (input.firing && !this.projectiles.playerShotAlive) {
      this.projectiles.fireFromPlayer(this.player.x, this.player.y);
      this.events.onSound("laser");
    }
    if (input.detonateRequested) {
      const bomb = this.bombs.findNear(this.player.x, this.player.y, 3);
      if (bomb) this.detonateBomb(bomb);
    }

    this.projectiles.tick(dt);

    const enemyEvents: EnemyEvents = {
      spawnMushroom: (col, row) => this.mushrooms.spawn(col, row),
      poisonMushroom: (col, row) => {
        this.mushrooms.poison(col, row);
        this.events.onSound("poison");
      },
      eatMushroom: (col, row) => {
        const m = this.mushrooms.at(col, row);
        if (m) this.mushrooms.grid[row][col] = null;
      },
      shiftGrid: (delta) => this.mushrooms.shiftRows(delta),
      triggerTimeDilation: () => (this.timeDilationTimer = 6),
      score: (points) => this.addScore(this.applySwarmMultiplier(points)),
    };

    this.millipede.tick(
      dilated,
      this.mushrooms,
      this.rng,
      (p) => this.addScore(p),
      () => {},
    );
    this.enemies.tick(dilated, this.rng, enemyEvents);
    this.bombs.tick(dt, () => {});

    this.updateSpawning(dt);
    this.resolveCollisions();
    this.checkWaveComplete();

    if (this.swarmActive) {
      this.swarmTimer -= dt;
      if (this.swarmTimer <= 0) this.swarmActive = false;
    }
  }

  private applySwarmMultiplier(points: number): number {
    if (!this.swarmActive) return points;
    this.swarmCombo++;
    const multiplier = Math.min(10, 1 + this.swarmCombo * 0.5);
    return Math.min(SCORING.swarmMaxMultiplier, Math.round(points * multiplier));
  }

  private updateSpawning(dt: number): void {
    this.bombMaintainTimer -= dt;
    if (this.bombMaintainTimer <= 0) {
      this.bombMaintainTimer = 4;
      this.bombs.maybeSpawn(this.rng);
    }

    if (this.swarmActive) {
      this.enemySpawnTimer -= dt * 3;
    } else {
      this.enemySpawnTimer -= dt;
    }
    if (this.enemySpawnTimer <= 0) {
      this.enemySpawnTimer = this.swarmActive ? 0.4 : this.rng.range(2.5, 5);
      const kind = this.swarmActive ? this.swarmKind : this.rng.pick(earlyKinds(this.wave));
      this.enemies.spawn(kind, this.rng);
    }
  }

  private detonateBomb(bomb: Bomb): void {
    this.bombs.detonate(bomb);
    this.events.onSound("explosion");
    const radius = this.bombs.blastRadius;
    this.millipede.blastHit(
      bomb.col,
      bomb.row,
      radius,
      (p) => this.addScore(this.applySwarmMultiplier(p)),
      SCORING.bombMultiplier,
    );
    const dist = Math.hypot(this.player.x - bomb.col, this.player.y - bomb.row);
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - bomb.col, e.y - bomb.row) <= radius) {
        this.enemies.kill(
          e,
          dist,
          {
            spawnMushroom: () => {},
            poisonMushroom: () => {},
            eatMushroom: () => {},
            shiftGrid: (d) => this.mushrooms.shiftRows(d),
            triggerTimeDilation: () => (this.timeDilationTimer = 6),
            score: (p) => this.addScore(this.applySwarmMultiplier(p)),
          },
          SCORING.bombMultiplier,
        );
      }
    }
  }

  private resolveCollisions(): void {
    const hash = this.spatialHash;
    hash.clear();

    this.mushrooms.forEach((m) => hash.insert(m.col, m.row, { type: "mushroom", col: m.col, row: m.row }));
    for (const chain of this.millipede.chains) {
      chain.segments.forEach((seg, index) =>
        hash.insert(seg.x, seg.row, { type: "segment", chainId: chain.id, index, col: seg.col, row: seg.row }),
      );
    }
    for (const e of this.enemies.enemies) {
      if (e.alive) hash.insert(e.x, e.y, { type: "enemy", id: e.id, x: e.x, y: e.y });
    }
    for (const b of this.bombs.bombs) {
      if (b.alive && !b.detonating) hash.insert(b.col, b.row, { type: "bomb", id: b.id, col: b.col, row: b.row });
    }

    for (const p of this.projectiles.projectiles) {
      if (!p.alive) continue;
      const candidates = hash.queryNeighborhood(p.x, p.y);
      let best: HashEntry | null = null;
      let bestDist = HIT_RADIUS;
      for (const c of candidates) {
        const cx = "x" in c ? c.x : c.col;
        const cy = "y" in c ? c.y : c.row;
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (!best) continue;
      p.alive = false;

      if (best.type === "mushroom") {
        this.mushrooms.hit(best.col, best.row, (pts) => this.addScore(pts));
        this.events.onSound("mushroomHit");
      } else if (best.type === "segment") {
        this.millipede.hitSegment(best.chainId, best.index, this.mushrooms, (pts) =>
          this.addScore(this.applySwarmMultiplier(pts)),
        );
        this.events.onSound("enemyKilled");
      } else if (best.type === "enemy") {
        const enemy = this.enemies.enemies.find((e) => e.id === best.id);
        if (enemy) {
          const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
          this.enemies.hit(enemy, dist, {
            spawnMushroom: (col, row) => this.mushrooms.spawn(col, row),
            poisonMushroom: (col, row) => this.mushrooms.poison(col, row),
            eatMushroom: () => {},
            shiftGrid: (d) => this.mushrooms.shiftRows(d),
            triggerTimeDilation: () => (this.timeDilationTimer = 6),
            score: (p) => this.addScore(this.applySwarmMultiplier(p)),
          });
          this.events.onSound("enemyKilled");
        }
      } else if (best.type === "bomb") {
        const bomb = this.bombs.bombs.find((b) => b.id === best.id);
        if (bomb) this.detonateBomb(bomb);
      }
    }

    if (!this.player.alive) return;
    for (const chain of this.millipede.chains) {
      for (const seg of chain.segments) {
        if (Math.hypot(this.player.x - seg.x, this.player.y - seg.row) < PLAYER_DEATH_RADIUS) {
          this.killPlayer();
          return;
        }
      }
    }
    for (const e of this.enemies.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(this.player.x - e.x, this.player.y - e.y) < PLAYER_DEATH_RADIUS) {
        this.killPlayer();
        return;
      }
    }
  }

  private killPlayer(): void {
    this.events.onSound("playerDeath");
    this.mushrooms.restoreAll((pts) => this.addScore(pts));
    const remainingLives = this.player.lives - 1;
    this.events.onLivesChange(remainingLives);
    if (remainingLives < 0) {
      this.state = "gameover";
      this.events.onGameOver(this.score);
      return;
    }
    this.player = createPlayer();
    this.player.lives = remainingLives;
  }

  private checkWaveComplete(): void {
    if (this.millipede.chains.length > 0) return;
    if (this.millipede.totalSegments > 0) return;
    this.mushrooms.regenerate(this.rng);
    this.wave++;
    this.events.onWaveChange(this.wave);
    this.spawnWaveMillipede();
  }

  /** 0 (far) .. 1 (at the player's doorstep) — drives the granular millipede audio engine. */
  millipedeProximity(): number {
    let closest = 0;
    for (const chain of this.millipede.chains) {
      const row = chain.segments[0]?.row ?? 0;
      closest = Math.max(closest, row / GRID_ROWS);
    }
    return closest;
  }
}

function earlyKinds(wave: number): EnemyKind[] {
  const all: EnemyKind[] = ["spider", "earwig", "bee", "inchworm", "beetle", "dragonfly", "mosquito"];
  const unlocked = Math.min(all.length, 2 + Math.floor(wave / 2));
  return all.slice(0, unlocked);
}
