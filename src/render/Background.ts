import * as THREE from "three";
import { GRID_COLS, GRID_ROWS } from "../core/constants";

/** Deep digital void: a slow-drifting particle data-stream field plus a faint floor grid, for parallax depth. */
export function buildBackground(scene: THREE.Scene): { update(dt: number): void } {
  const particleCount = 600;
  const positions = new Float32Array(particleCount * 3);
  const speeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * GRID_COLS * 4;
    positions[i * 3 + 1] = Math.random() * 30 - 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * GRID_ROWS * 4;
    speeds[i] = 0.4 + Math.random() * 1.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x552266,
    size: 0.12,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const floor = new THREE.GridHelper(Math.max(GRID_COLS, GRID_ROWS) * 1.4, 24, 0x1a0a33, 0x1a0a33);
  (floor.material as THREE.Material).transparent = true;
  (floor.material as THREE.Material).opacity = 0.35;
  floor.position.y = -0.55;
  scene.add(floor);

  scene.fog = new THREE.FogExp2(0x03000a, 0.018);

  return {
    update(dt: number) {
      const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        let y = attr.getY(i) - speeds[i] * dt;
        if (y < -6) y = 24;
        attr.setY(i, y);
      }
      attr.needsUpdate = true;
    },
  };
}
