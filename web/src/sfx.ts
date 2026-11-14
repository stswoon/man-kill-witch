// Minimal WebAudio blips in the spirit of early PC synthesis.
export class Sfx {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) { this.enabled = false; return null; }
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private blip(freq: number, duration: number, type: OscillatorType, volume = 0.05, slide = 0): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  shoot(): void { this.blip(720, 0.07, "square", 0.05, -420); }
  hit(): void { this.blip(180, 0.12, "square", 0.06, -120); }
  jump(): void { this.blip(320, 0.08, "square", 0.04, 160); }
  pickup(): void { this.blip(880, 0.07, "square", 0.04, 220); }
  die(): void { this.blip(260, 0.35, "sawtooth", 0.06, -200); }
  door(): void { this.blip(440, 0.12, "square", 0.05, 180); }
  win(): void {
    this.blip(523, 0.12, "square", 0.05);
    setTimeout(() => this.blip(659, 0.12, "square", 0.05), 130);
    setTimeout(() => this.blip(784, 0.2, "square", 0.05), 260);
  }
}
