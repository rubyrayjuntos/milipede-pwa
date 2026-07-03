import type { Projectile } from "./types";

const SPEED = 22; // grid cells/sec, travelling up-screen (decreasing row)

export class ProjectileSystem {
  projectiles: Projectile[] = [];
  private nextId = 0;

  get playerShotAlive(): boolean {
    return this.projectiles.some((p) => p.alive && p.owner === "player");
  }

  fireFromPlayer(x: number, y: number): void {
    this.projectiles.push({ id: this.nextId++, x, y, vy: -SPEED, owner: "player", alive: true });
  }

  tick(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.y += p.vy * dt;
      if (p.y < 0) p.alive = false;
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  clear(): void {
    this.projectiles = [];
  }
}
