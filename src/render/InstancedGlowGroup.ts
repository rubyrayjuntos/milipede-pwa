import * as THREE from "three";
import { createGlowMaterial, createWireMaterial } from "./GlowMaterial";

/**
 * Renders many copies of one geometry in exactly two draw calls (wireframe pass
 * + additive fresnel glow pass) via THREE.InstancedMesh, regardless of instance
 * count. Keeps total scene draw calls far under the mobile budget.
 */
export class InstancedGlowGroup {
  readonly wireMesh: THREE.InstancedMesh;
  readonly glowMesh: THREE.InstancedMesh;
  private cursor = 0;
  private readonly dummy = new THREE.Object3D();

  constructor(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation, maxCount: number, scene: THREE.Scene) {
    this.wireMesh = new THREE.InstancedMesh(geometry, createWireMaterial(color), maxCount);
    this.glowMesh = new THREE.InstancedMesh(geometry, createGlowMaterial(color), maxCount);
    this.wireMesh.count = 0;
    this.glowMesh.count = 0;
    this.wireMesh.frustumCulled = false;
    this.glowMesh.frustumCulled = false;
    scene.add(this.wireMesh, this.glowMesh);
  }

  begin(): void {
    this.cursor = 0;
  }

  push(x: number, y: number, z: number, scale = 1, rotationY = 0): void {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotationY, 0);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.wireMesh.setMatrixAt(this.cursor, this.dummy.matrix);
    this.glowMesh.setMatrixAt(this.cursor, this.dummy.matrix);
    this.cursor++;
  }

  end(): void {
    this.wireMesh.count = this.cursor;
    this.glowMesh.count = this.cursor;
    this.wireMesh.instanceMatrix.needsUpdate = true;
    this.glowMesh.instanceMatrix.needsUpdate = true;
  }

  updateCamera(pos: THREE.Vector3): void {
    (this.glowMesh.material as THREE.ShaderMaterial).uniforms.uCameraPos.value.copy(pos);
  }
}
