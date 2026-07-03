import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GRID_COLS, GRID_ROWS, COLORS } from "../core/constants";
import { World } from "../sim/World";
import { InstancedGlowGroup } from "./InstancedGlowGroup";
import { gridToWorld } from "./coords";
import { buildBackground } from "./Background";
import type { EnemyKind } from "../sim/types";

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export class SceneRenderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private background: ReturnType<typeof buildBackground>;

  private mushroomGroup: InstancedGlowGroup;
  private millipedeGroup: InstancedGlowGroup;
  private projectileGroup: InstancedGlowGroup;
  private bombGroup: InstancedGlowGroup;
  private blastGroup: InstancedGlowGroup;
  private playerGroup: InstancedGlowGroup;
  private enemyGroups: Record<EnemyKind, InstancedGlowGroup>;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 2 : 2.5));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.4;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 15, GRID_ROWS * 0.55 + 6);
    this.camera.lookAt(0, 0, -2);

    this.scene.background = new THREE.Color(0x03000a);
    this.background = buildBackground(this.scene);

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 1.2, 0.4, 0.2);
    if (isMobile) this.bloomPass.resolution.set(w / 2, h / 2);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.mushroomGroup = new InstancedGlowGroup(
      new THREE.IcosahedronGeometry(0.42, 0),
      COLORS.mushroom,
      GRID_COLS * GRID_ROWS,
      this.scene,
    );
    this.millipedeGroup = new InstancedGlowGroup(
      new THREE.OctahedronGeometry(0.42, 0),
      COLORS.millipede,
      400,
      this.scene,
    );
    this.projectileGroup = new InstancedGlowGroup(
      new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6),
      COLORS.projectile,
      32,
      this.scene,
    );
    this.bombGroup = new InstancedGlowGroup(new THREE.DodecahedronGeometry(0.38, 0), COLORS.bomb, 8, this.scene);
    this.blastGroup = new InstancedGlowGroup(
      new THREE.IcosahedronGeometry(1, 1),
      COLORS.bombBlast,
      8,
      this.scene,
    );
    this.playerGroup = new InstancedGlowGroup(
      new THREE.ConeGeometry(0.4, 1.0, 4),
      COLORS.player,
      1,
      this.scene,
    );

    this.enemyGroups = {
      spider: new InstancedGlowGroup(new THREE.TetrahedronGeometry(0.42, 0), COLORS.enemy, 40, this.scene),
      earwig: new InstancedGlowGroup(new THREE.BoxGeometry(0.9, 0.25, 0.25), COLORS.enemy, 20, this.scene),
      bee: new InstancedGlowGroup(new THREE.SphereGeometry(0.32, 8, 6), COLORS.enemy, 20, this.scene),
      inchworm: new InstancedGlowGroup(new THREE.CapsuleGeometry(0.16, 0.5, 4, 8), COLORS.enemy, 12, this.scene),
      beetle: new InstancedGlowGroup(new THREE.DodecahedronGeometry(0.36, 0), COLORS.enemy, 12, this.scene),
      dragonfly: new InstancedGlowGroup(new THREE.OctahedronGeometry(0.44, 0), COLORS.enemy, 16, this.scene),
      mosquito: new InstancedGlowGroup(new THREE.TetrahedronGeometry(0.3, 0), COLORS.enemy, 20, this.scene),
    };

    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(isMobile ? w / 2 : w, isMobile ? h / 2 : h);
  };

  /** Screen-wide bloom flash while a DDT bomb detonates, per spec section 4.3. */
  setBombFlash(active: boolean): void {
    this.bloomPass.strength = active ? 3.0 : 1.2;
  }

  render(world: World, dt: number): void {
    this.background.update(dt);

    this.mushroomGroup.begin();
    world.mushrooms.forEach((m) => {
      const scale = world.mushrooms.scaleFor(m);
      if (scale <= 0) return;
      const [x, y, z] = gridToWorld(m.col, m.row, 0.1);
      this.mushroomGroup.push(x, y, z, scale * 0.85);
    });
    this.mushroomGroup.end();

    this.millipedeGroup.begin();
    for (const chain of world.millipede.chains) {
      for (const seg of chain.segments) {
        const [x, y, z] = gridToWorld(seg.x, seg.row, 0.42);
        this.millipedeGroup.push(x, y, z, seg.isHead ? 1.15 : 0.95);
      }
    }
    this.millipedeGroup.end();

    this.projectileGroup.begin();
    for (const p of world.projectiles.projectiles) {
      const [x, y, z] = gridToWorld(p.x, p.y, 0.3);
      this.projectileGroup.push(x, y, z, 1, Math.PI / 2);
    }
    this.projectileGroup.end();

    this.bombGroup.begin();
    this.blastGroup.begin();
    let anyBlast = false;
    for (const b of world.bombs.bombs) {
      const [x, y, z] = gridToWorld(b.col, b.row, 0.4);
      if (b.detonating) {
        anyBlast = true;
        const t = 1 - Math.max(0, b.blastTimer) / 0.35;
        this.blastGroup.push(x, y, z, world.bombs.blastRadius * (0.2 + t * 1.1));
      } else if (b.alive) {
        this.bombGroup.push(x, y, z, 1);
      }
    }
    this.bombGroup.end();
    this.blastGroup.end();
    this.setBombFlash(anyBlast);

    for (const kind of Object.keys(this.enemyGroups) as EnemyKind[]) {
      this.enemyGroups[kind].begin();
    }
    for (const e of world.enemies.enemies) {
      if (!e.alive) continue;
      const [x, y, z] = gridToWorld(e.x, e.y, 0.4);
      this.enemyGroups[e.kind].push(x, y, z, 1);
    }
    for (const kind of Object.keys(this.enemyGroups) as EnemyKind[]) {
      this.enemyGroups[kind].end();
    }

    this.playerGroup.begin();
    if (world.player.alive) {
      const [x, y, z] = gridToWorld(world.player.x, world.player.y, 0.4);
      this.playerGroup.push(x, y, z, 1);
    }
    this.playerGroup.end();

    const cam = this.camera.position;
    for (const g of [
      this.mushroomGroup,
      this.millipedeGroup,
      this.projectileGroup,
      this.bombGroup,
      this.blastGroup,
      this.playerGroup,
      ...Object.values(this.enemyGroups),
    ]) {
      g.updateCamera(cam);
    }

    this.composer.render();
  }
}
