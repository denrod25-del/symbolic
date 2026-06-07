/**
 * Tiny synthesized sound effects via the Web Audio API — no audio files. Each
 * effect is a short oscillator with a gain envelope.
 *
 * Browsers block audio until a user gesture, so the AudioContext is created
 * lazily and resumed on the first key/pointer interaction.
 */
export class Sfx {
  private ctx: AudioContext | null = null;

  constructor() {
    const unlock = () => {
      this.ensureContext();
      void this.ctx?.resume();
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  jump() {
    this.tone({ from: 320, to: 640, dur: 0.14, type: 'square', gain: 0.18 });
  }

  coin() {
    this.tone({ from: 880, to: 880, dur: 0.06, type: 'triangle', gain: 0.18 });
    this.tone({ from: 1320, to: 1320, dur: 0.1, type: 'triangle', gain: 0.18, delay: 0.06 });
  }

  stomp() {
    this.tone({ from: 220, to: 70, dur: 0.12, type: 'square', gain: 0.22 });
  }

  die() {
    this.tone({ from: 440, to: 90, dur: 0.5, type: 'sawtooth', gain: 0.22 });
  }

  win() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      this.tone({ from: freq, to: freq, dur: 0.12, type: 'square', gain: 0.18, delay: i * 0.12 });
    });
  }

  private ensureContext() {
    this.ctx ??= new AudioContext();
  }

  private tone(opts: {
    from: number;
    to: number;
    dur: number;
    type: OscillatorType;
    gain: number;
    delay?: number;
  }) {
    this.ensureContext();
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const start = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.from, start);
    if (opts.to !== opts.from) {
      osc.frequency.exponentialRampToValueAtTime(opts.to, start + opts.dur);
    }
    gain.gain.setValueAtTime(opts.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + opts.dur);
  }
}
