export type EnemyKind =
  | "spider"
  | "earwig"
  | "bee"
  | "inchworm"
  | "beetle"
  | "dragonfly"
  | "mosquito";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Mushroom {
  col: number;
  row: number;
  hits: number; // 0..4, 4 = destroyed
  poisoned: boolean;
  alive: boolean;
}

export interface MillipedeSegment {
  id: number;
  col: number;
  row: number;
  /** fractional column position for smooth interpolation between grid cells */
  x: number;
  isHead: boolean;
  chainId: number;
}

export interface MillipedeChain {
  id: number;
  segments: MillipedeSegment[]; // head-first
  direction: 1 | -1;
  speed: number; // cells/sec
  state: "traversing" | "plunging" | "penaltyZone";
  penaltyTimer: number;
}

export interface Bomb {
  id: number;
  col: number;
  row: number;
  alive: boolean;
  detonating: boolean;
  blastTimer: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vy: number; // world units/sec, negative = travelling up-screen
  owner: "player";
  alive: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  age: number;
  data: Record<string, number>;
}

export interface Player {
  x: number;
  y: number;
  alive: boolean;
  lives: number;
}

export type GameState = "menu" | "playing" | "paused" | "gameover";
