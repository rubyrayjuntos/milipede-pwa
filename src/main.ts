import "./style.css";
import { GameLoop } from "./core/GameLoop";
import { World, type WorldEvents } from "./sim/World";
import { SceneRenderer } from "./render/SceneRenderer";
import { TouchControls } from "./input/TouchControls";
import { AudioEngine } from "./audio/AudioEngine";
import { HUD } from "./ui/HUD";
import { registerServiceWorker } from "./pwa/registerSW";
import { submitHighScore, getLocalBestScore } from "./pwa/ScoreQueue";

registerServiceWorker();

const app = document.getElementById("app")!;
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

const audio = new AudioEngine();
const sceneRenderer = new SceneRenderer(canvas);
const controls = new TouchControls(app);

let bestScore = 0;
getLocalBestScore().then((b) => (bestScore = b));

const events: WorldEvents = {
  onScoreChange: (score) => {
    hud.setScore(score);
    audio.setScore(score);
  },
  onLivesChange: (lives) => hud.setLives(lives),
  onWaveChange: (wave) => hud.setWave(wave),
  onGameOver: (finalScore) => {
    audio.stopMusic();
    audio.stopGranular();
    bestScore = Math.max(bestScore, finalScore);
    submitHighScore(finalScore).catch(() => {});
    hud.showGameOver(finalScore, bestScore);
  },
  onSound: (name) => {
    if (!audio.ready) return;
    switch (name) {
      case "laser":
        audio.playLaser();
        break;
      case "explosion":
        audio.playExplosion();
        break;
      case "poison":
        audio.playPoison();
        break;
      case "enemyKilled":
        audio.playEnemyKill();
        break;
      case "playerDeath":
        audio.playPlayerDeath();
        break;
      case "mushroomHit":
        break;
    }
  },
};

const world = new World(events);

function beginRun(): void {
  audio.init();
  audio.startMusic();
  audio.startGranular();
  hud.hideOverlays();
  world.start();
}

const hud = new HUD(app, {
  onStart: beginRun,
  onRestart: beginRun,
});
hud.showMenu();

const loop = new GameLoop(
  (dt) => {
    const input = controls.consumeFrame();
    world.tick(dt, input);
    audio.setMillipedeProximity(world.millipedeProximity());
  },
  (_alpha) => {
    sceneRenderer.render(world, 1 / 60);
  },
);
loop.start();
