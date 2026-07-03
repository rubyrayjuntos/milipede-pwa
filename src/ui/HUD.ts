export interface HUDCallbacks {
  onStart(): void;
  onRestart(): void;
}

export class HUD {
  private root: HTMLDivElement;
  private scoreEl: HTMLDivElement;
  private livesEl: HTMLDivElement;
  private waveEl: HTMLDivElement;
  private menuEl: HTMLDivElement;
  private gameOverEl: HTMLDivElement;
  private finalScoreEl: HTMLSpanElement;
  private bestScoreEl: HTMLSpanElement;

  constructor(container: HTMLElement, callbacks: HUDCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hud-bar">
        <div class="hud-stat" id="hud-score">SCORE 0</div>
        <div class="hud-stat" id="hud-wave">WAVE 1</div>
        <div class="hud-stat" id="hud-lives">LIVES 3</div>
      </div>
      <div class="hud-menu" id="hud-menu">
        <h1>MILLIPEDE</h1>
        <p class="subtitle">neon wireframe // procedural arcade</p>
        <button id="hud-start">TAP TO START</button>
        <p class="hint">left thumb: move &middot; right thumb: hold to fire &middot; double-tap: detonate DDT</p>
      </div>
      <div class="hud-gameover" id="hud-gameover" style="display:none">
        <h1>GAME OVER</h1>
        <p>SCORE: <span id="hud-final-score">0</span></p>
        <p class="best">BEST: <span id="hud-best-score">0</span></p>
        <button id="hud-restart">PLAY AGAIN</button>
      </div>
    `;
    container.appendChild(this.root);

    this.scoreEl = this.root.querySelector("#hud-score")!;
    this.livesEl = this.root.querySelector("#hud-lives")!;
    this.waveEl = this.root.querySelector("#hud-wave")!;
    this.menuEl = this.root.querySelector("#hud-menu")!;
    this.gameOverEl = this.root.querySelector("#hud-gameover")!;
    this.finalScoreEl = this.root.querySelector("#hud-final-score")!;
    this.bestScoreEl = this.root.querySelector("#hud-best-score")!;

    this.root.querySelector("#hud-start")!.addEventListener("click", callbacks.onStart);
    this.root.querySelector("#hud-restart")!.addEventListener("click", callbacks.onRestart);
  }

  setScore(score: number): void {
    this.scoreEl.textContent = `SCORE ${score}`;
  }

  setWave(wave: number): void {
    this.waveEl.textContent = `WAVE ${wave}`;
  }

  setLives(lives: number): void {
    this.livesEl.textContent = `LIVES ${Math.max(0, lives + 1)}`;
  }

  showMenu(): void {
    this.menuEl.style.display = "flex";
    this.gameOverEl.style.display = "none";
  }

  showGameOver(score: number, best: number): void {
    this.gameOverEl.style.display = "flex";
    this.menuEl.style.display = "none";
    this.finalScoreEl.textContent = String(score);
    this.bestScoreEl.textContent = String(best);
  }

  hideOverlays(): void {
    this.menuEl.style.display = "none";
    this.gameOverEl.style.display = "none";
  }
}
