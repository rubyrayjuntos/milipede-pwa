// Playfield grid dimensions (logic space). Classic Millipede board, widened for mobile landscape.
export const GRID_COLS = 20;
export const GRID_ROWS = 24;

// Bottom band the player is confined to ("gray zone" of the original cabinet).
export const PLAYER_ZONE_ROWS = 5;
export const PLAYER_ZONE_START_ROW = GRID_ROWS - PLAYER_ZONE_ROWS;

export const CELL_SIZE = 1;

// Fixed simulation timestep: 60 ticks/sec, independent of render framerate.
export const TICK_RATE = 60;
export const TICK_DT = 1 / TICK_RATE;

export const MAX_MUSHROOMS = 1500;
export const MUSHROOM_HITS_TO_KILL = 4;

export const COLORS = {
  player: 0x00ffff,
  projectile: 0x00ffff,
  mushroom: 0x0000ff,
  mushroomPoisoned: 0x39ff14,
  millipede: 0xff00ff,
  enemy: 0xff1493,
  bomb: 0xffffff,
  bombBlast: 0xffe680,
} as const;

export const SCORING = {
  mushroomDestroyed: 1,
  mushroomRestored: 5,
  millipedeBody: 10,
  millipedeHead: 100,
  bombMultiplier: 3,
  swarmMaxMultiplier: 1000,
} as const;
