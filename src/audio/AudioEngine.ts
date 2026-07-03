/**
 * Zero-dependency procedural audio: every sound is synthesized in real time via
 * the Web Audio API graph (oscillators, noise buffers, filters, envelopes).
 * No static audio assets are loaded, per spec section 7.
 */

const PENTATONIC = [0, 3, 5, 7, 10]; // minor pentatonic scale degrees (semitones)
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private duckGain!: GainNode;

  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private bpm = 96;
  private rootMidi = 45; // A2
  private scale = PENTATONIC;

  private grainTimer: number | null = null;
  private proximity = 0;
  private noiseBuffer: AudioBuffer | null = null;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (touchstart/click) to satisfy autoplay policy. */
  init(): void {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // Sidechain-style ducking: sfx transients pull the music bus gain down instantly,
    // then it recovers, keeping explosions/lasers legible during chaotic swarms.
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -28;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.25;

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.35;
    this.musicBus.connect(this.duckGain).connect(this.compressor).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.compressor).connect(this.master);

    this.nextNoteTime = ctx.currentTime;
  }

  private duck(amount: number, releaseTime: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(Math.max(0.05, 1 - amount), now);
    this.duckGain.gain.linearRampToValueAtTime(1, now + releaseTime);
  }

  // --- One-shot SFX -------------------------------------------------------

  playLaser(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playExplosion(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 1.1;

    if (!this.noiseBuffer) {
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      this.noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(8000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(gain).connect(this.sfxBus);
    noise.start(now);
    noise.stop(now + duration);

    this.duck(0.7, 0.5);
  }

  playPoison(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  playEnemyKill(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playPlayerDeath(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.82);
    this.duck(0.5, 0.8);
  }

  // --- Generative score ----------------------------------------------------

  startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** As score climbs, tempo rises and harmony shifts toward the more dissonant Phrygian dominant scale. */
  setScore(score: number): void {
    this.bpm = Math.min(190, 96 + score / 150);
    this.scale = score > 4000 ? PHRYGIAN_DOMINANT : PENTATONIC;
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const secondsPerBeat = 60 / this.bpm;
    while (this.nextNoteTime < ctx.currentTime + 0.2) {
      const degree = this.scale[Math.floor(Math.random() * this.scale.length)];
      const octave = Math.random() < 0.3 ? 12 : 0;
      const midi = this.rootMidi + degree + octave;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      this.pluckNote(freq, this.nextNoteTime, secondsPerBeat * 0.9);
      this.nextNoteTime += secondsPerBeat * (Math.random() < 0.25 ? 0.5 : 1);
    }
  }

  private pluckNote(freq: number, time: number, duration: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  // --- Granular millipede drone ---------------------------------------------

  /** proximity in [0,1]: 0 = millipede far from the player row, 1 = at the doorstep. */
  setMillipedeProximity(p: number): void {
    this.proximity = p;
  }

  startGranular(): void {
    if (!this.ctx || this.grainTimer !== null) return;
    const scheduleNext = () => {
      this.emitGrain();
      const density = 30 + this.proximity * 80; // ms between grains, denser as it nears
      this.grainTimer = window.setTimeout(scheduleNext, Math.max(15, 60 - density * 0.3));
    };
    scheduleNext();
  }

  stopGranular(): void {
    if (this.grainTimer !== null) {
      clearTimeout(this.grainTimer);
      this.grainTimer = null;
    }
  }

  private emitGrain(): void {
    const ctx = this.ctx;
    if (!ctx || this.proximity <= 0.02) return;
    const now = ctx.currentTime;
    const grainLen = (10 + Math.random() * 40) / 1000;
    const basePitch = 90 + this.proximity * 260;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = basePitch * (0.95 + Math.random() * 0.1);

    const gain = ctx.createGain();
    const vol = 0.05 + this.proximity * 0.15;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + grainLen * 0.3);
    gain.gain.linearRampToValueAtTime(0, now + grainLen);

    osc.connect(gain).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + grainLen + 0.02);
  }
}
