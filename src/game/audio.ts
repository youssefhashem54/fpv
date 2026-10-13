/* ------------------------------------------------------------------ */
/*  Synthesized audio: motors, wind, UI, chimes — no external files   */
/* ------------------------------------------------------------------ */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private motorOscA: OscillatorNode | null = null;
  private motorOscB: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private propGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  muted = false;
  private started = false;

  /** Must be called from a user gesture */
  start() {
    if (this.started) {
      this.ctx?.resume().catch(() => undefined);
      return;
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(ctx.destination);

      // shared noise buffer
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // --- motors: two detuned saws through a lowpass ---
      this.motorGain = ctx.createGain();
      this.motorGain.gain.value = 0;
      const motorFilter = ctx.createBiquadFilter();
      motorFilter.type = "lowpass";
      motorFilter.frequency.value = 420;
      motorFilter.Q.value = 2.5;
      this.motorOscA = ctx.createOscillator();
      this.motorOscA.type = "sawtooth";
      this.motorOscA.frequency.value = 70;
      this.motorOscB = ctx.createOscillator();
      this.motorOscB.type = "square";
      this.motorOscB.frequency.value = 71.8;
      const ob = ctx.createGain();
      ob.gain.value = 0.4;
      this.motorOscA.connect(motorFilter);
      this.motorOscB.connect(ob);
      ob.connect(motorFilter);
      motorFilter.connect(this.motorGain);
      this.motorGain.connect(this.master);
      this.motorOscA.start();
      this.motorOscB.start();

      // --- prop wash: bandpassed noise ---
      this.propGain = ctx.createGain();
      this.propGain.gain.value = 0;
      const propFilter = ctx.createBiquadFilter();
      propFilter.type = "bandpass";
      propFilter.frequency.value = 1500;
      propFilter.Q.value = 0.8;
      const propSrc = ctx.createBufferSource();
      propSrc.buffer = this.noiseBuf;
      propSrc.loop = true;
      propSrc.connect(propFilter);
      propFilter.connect(this.propGain);
      this.propGain.connect(this.master);
      propSrc.start();

      // --- wind: lowpassed noise, gain follows speed ---
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = "lowpass";
      this.windFilter.frequency.value = 400;
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuf;
      windSrc.loop = true;
      windSrc.playbackRate.value = 0.55;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSrc.start();

      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  setFlight(throttle: number, speedNorm: number, active: boolean) {
    if (!this.ctx || !this.started) return;
    const t = this.ctx.currentTime;
    const th = active ? throttle : 0;
    const sn = active ? speedNorm : 0;
    const base = 62 + th * 105 + sn * 34;
    this.motorOscA?.frequency.setTargetAtTime(base, t, 0.06);
    this.motorOscB?.frequency.setTargetAtTime(base * 1.015 + 1.6, t, 0.06);
    this.motorGain?.gain.setTargetAtTime(active ? 0.028 + th * 0.11 + sn * 0.03 : 0, t, 0.09);
    this.propGain?.gain.setTargetAtTime(th * 0.05 + sn * 0.1, t, 0.12);
    this.windGain?.gain.setTargetAtTime(sn * sn * 0.32, t, 0.15);
    this.windFilter?.frequency.setTargetAtTime(280 + sn * 1100, t, 0.15);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, freq: number, gain: number, delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1.4;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  passGate() {
    this.blip(987, 0.1, "sine", 0.34);
    this.blip(1480, 0.22, "sine", 0.28, 0.07);
    this.blip(1976, 0.3, "triangle", 0.12, 0.1);
  }

  missGate() {
    this.blip(196, 0.22, "square", 0.16);
    this.blip(147, 0.3, "square", 0.14, 0.08);
  }

  countBeep(final: boolean) {
    if (final) {
      this.blip(1318, 0.34, "square", 0.22);
      this.blip(2637, 0.4, "sine", 0.16, 0.02);
    } else {
      this.blip(659, 0.11, "square", 0.18);
    }
  }

  crash() {
    this.noiseBurst(0.5, 340, 0.5);
    this.blip(160, 0.5, "sawtooth", 0.3, 0, 36);
    this.noiseBurst(0.28, 1200, 0.2, 0.03);
  }

  finish() {
    const seq = [523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => this.blip(f, 0.34, "sine", 0.22, i * 0.09));
    this.blip(2093, 0.7, "sine", 0.12, 0.5);
  }

  /** player laser bolt */
  shoot() {
    this.blip(920, 0.09, "square", 0.12, 0, 210);
    this.blip(1840, 0.05, "sawtooth", 0.05, 0, 640);
  }

  /** hostile bolt — lower, nastier */
  enemyShoot() {
    this.blip(300, 0.16, "sawtooth", 0.14, 0, 82);
    this.blip(150, 0.2, "square", 0.06, 0.02, 60);
  }

  /** bolt connected with a target */
  hit() {
    this.blip(1500, 0.06, "square", 0.16);
    this.noiseBurst(0.08, 2600, 0.14);
  }

  explode() {
    this.noiseBurst(0.55, 620, 0.5);
    this.blip(210, 0.5, "sawtooth", 0.3, 0, 30);
    this.blip(96, 0.65, "square", 0.2, 0.03, 28);
  }

  /** bolt passing close by */
  whoosh() {
    this.noiseBurst(0.22, 1400 + Math.random() * 800, 0.13);
  }

  /** empty-energy click */
  dry() {
    this.blip(170, 0.05, "square", 0.1);
  }

  ui() {
    this.blip(523, 0.05, "square", 0.1);
    this.blip(1046, 0.08, "sine", 0.08, 0.03);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
  }
}
