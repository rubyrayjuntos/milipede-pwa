import { GRID_COLS, GRID_ROWS, PLAYER_ZONE_START_ROW } from "../core/constants";
import type { Player } from "./types";

export function createPlayer(): Player {
  return {
    x: GRID_COLS / 2,
    y: GRID_ROWS - 2,
    alive: true,
    lives: 2, // displayed as 3 (current life + 2 in reserve); game over once this drops below 0
  };
}

/** Applies a raw movement delta (already run through the input acceleration curve) and clamps to the gray zone. */
export function movePlayer(player: Player, dx: number, dy: number): void {
  player.x = Math.max(0.3, Math.min(GRID_COLS - 1.3, player.x + dx));
  player.y = Math.max(PLAYER_ZONE_START_ROW + 0.3, Math.min(GRID_ROWS - 1.3, player.y + dy));
}
