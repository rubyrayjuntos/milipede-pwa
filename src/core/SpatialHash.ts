/**
 * Uniform grid spatial hash. Reduces broad-phase collision checks from O(n^2)
 * to O(1) per query by only scanning the occupied cell and its neighbors.
 */
export class SpatialHash<T> {
  private cellW: number;
  private cellH: number;
  private gridW: number;
  private buckets = new Map<number, T[]>();

  constructor(cellW: number, cellH: number, gridW: number) {
    this.cellW = cellW;
    this.cellH = cellH;
    this.gridW = gridW;
  }

  private hash(x: number, y: number): number {
    const cx = Math.floor(x / this.cellW);
    const cy = Math.floor(y / this.cellH);
    return cx + cy * this.gridW;
  }

  clear(): void {
    this.buckets.clear();
  }

  insert(x: number, y: number, item: T): void {
    const h = this.hash(x, y);
    let bucket = this.buckets.get(h);
    if (!bucket) {
      bucket = [];
      this.buckets.set(h, bucket);
    }
    bucket.push(item);
  }

  /** Returns items in the cell containing (x,y) and its 8 neighbors. */
  queryNeighborhood(x: number, y: number): T[] {
    const cx = Math.floor(x / this.cellW);
    const cy = Math.floor(y / this.cellH);
    const results: T[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const h = cx + dx + (cy + dy) * this.gridW;
        const bucket = this.buckets.get(h);
        if (bucket) results.push(...bucket);
      }
    }
    return results;
  }
}
