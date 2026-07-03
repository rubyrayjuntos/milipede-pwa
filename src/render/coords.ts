import { GRID_COLS, GRID_ROWS } from "../core/constants";

/** Maps logic-grid (col,row) to world space. Row increases toward the camera/player. */
export function gridToWorld(col: number, row: number, y = 0): [number, number, number] {
  return [col - GRID_COLS / 2, y, row - GRID_ROWS / 2];
}
