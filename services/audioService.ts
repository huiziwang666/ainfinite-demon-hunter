export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8; // Louder explosions
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  }

  public async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public playLaunch(charge: number) {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    // Rising pitch "Whoosh"
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(600 + (charge * 400), t + 0.3);

    // Envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  public playExplosion(size: number) {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Pink noise generation
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // (roughly) compensate for gain
      b6 = white * 0.115926;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Lowpass filter for "Boom" sound (muffled distance effect)
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Envelope - louder explosion
    const duration = 0.5 + size * 0.5;
    gain.gain.setValueAtTime(1.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.start(t);
    noise.stop(t + duration);
  }

  public playVictory() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Sparkle/shimmer effect - high frequency twinkles
    for (let i = 0; i < 8; i++) {
      const sparkle = this.ctx.createOscillator();
      const sparkleGain = this.ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.value = 2000 + Math.random() * 2000;
      sparkle.connect(sparkleGain);
      sparkleGain.connect(this.masterGain);
      const sparkleStart = t + i * 0.08;
      sparkleGain.gain.setValueAtTime(0, sparkleStart);
      sparkleGain.gain.linearRampToValueAtTime(0.15, sparkleStart + 0.02);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, sparkleStart + 0.15);
      sparkle.start(sparkleStart);
      sparkle.stop(sparkleStart + 0.15);
    }

    // K-pop style ascending arpeggio with layered synths
    const arpNotes = [523, 659, 784, 880, 1047, 1319, 1568, 2093]; // C5 to C7 arpeggio
    const arpDuration = 0.08;

    arpNotes.forEach((freq, i) => {
      // Main synth (saw for brightness)
      const osc1 = this.ctx!.createOscillator();
      const gain1 = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc1.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      filter.Q.value = 2;

      osc1.connect(filter);
      filter.connect(gain1);
      gain1.connect(this.masterGain!);

      const noteStart = t + 0.3 + i * arpDuration;
      gain1.gain.setValueAtTime(0, noteStart);
      gain1.gain.linearRampToValueAtTime(0.25, noteStart + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.01, noteStart + arpDuration + 0.2);

      osc1.start(noteStart);
      osc1.stop(noteStart + arpDuration + 0.2);

      // Sub layer (triangle for warmth)
      const osc2 = this.ctx!.createOscillator();
      const gain2 = this.ctx!.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = freq;
      osc2.connect(gain2);
      gain2.connect(this.masterGain!);
      gain2.gain.setValueAtTime(0, noteStart);
      gain2.gain.linearRampToValueAtTime(0.15, noteStart + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, noteStart + arpDuration + 0.15);
      osc2.start(noteStart);
      osc2.stop(noteStart + arpDuration + 0.15);
    });

    // Grand finale chord with rich harmonics
    const chordStart = t + 0.3 + arpNotes.length * arpDuration;
    const chordFreqs = [261, 329, 392, 523, 659, 784, 1047]; // Full C major chord

    chordFreqs.forEach((freq) => {
      // Layered oscillators for rich sound
      ['sine', 'triangle'].forEach((type, j) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = type as OscillatorType;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.masterGain!);

        const volume = j === 0 ? 0.2 : 0.1;
        gain.gain.setValueAtTime(0, chordStart);
        gain.gain.linearRampToValueAtTime(volume, chordStart + 0.05);
        gain.gain.setValueAtTime(volume, chordStart + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 2.0);

        osc.start(chordStart);
        osc.stop(chordStart + 2.0);
      });
    });

    // Final sparkle burst
    for (let i = 0; i < 12; i++) {
      const sparkle = this.ctx.createOscillator();
      const sparkleGain = this.ctx.createGain();
      sparkle.type = 'sine';
      sparkle.frequency.value = 1500 + Math.random() * 3000;
      sparkle.connect(sparkleGain);
      sparkleGain.connect(this.masterGain);
      const sparkleStart = chordStart + 0.1 + i * 0.05;
      sparkleGain.gain.setValueAtTime(0, sparkleStart);
      sparkleGain.gain.linearRampToValueAtTime(0.1, sparkleStart + 0.02);
      sparkleGain.gain.exponentialRampToValueAtTime(0.001, sparkleStart + 0.2);
      sparkle.start(sparkleStart);
      sparkle.stop(sparkleStart + 0.2);
    }
  }

  public playGameOver() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Dramatic impact hit
    const impact = this.ctx.createOscillator();
    const impactGain = this.ctx.createGain();
    impact.type = 'sine';
    impact.frequency.setValueAtTime(150, t);
    impact.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    impact.connect(impactGain);
    impactGain.connect(this.masterGain);
    impactGain.gain.setValueAtTime(0.6, t);
    impactGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    impact.start(t);
    impact.stop(t + 0.4);

    // Descending "wah wah" brass-like sound (minor key)
    const notes = [392, 311, 262, 196]; // G4, Eb4, C4, G3 - minor feel
    const noteDuration = 0.35;

    notes.forEach((freq, i) => {
      // Main tone with vibrato
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      // Wah filter effect
      filter.type = 'lowpass';
      filter.Q.value = 5;

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.masterGain!);

      const noteStart = t + 0.2 + i * noteDuration;

      // Filter sweep for "wah" effect
      filter.frequency.setValueAtTime(800, noteStart);
      filter.frequency.exponentialRampToValueAtTime(200, noteStart + noteDuration);

      oscGain.gain.setValueAtTime(0, noteStart);
      oscGain.gain.linearRampToValueAtTime(0.3, noteStart + 0.05);
      oscGain.gain.setValueAtTime(0.25, noteStart + noteDuration * 0.7);
      oscGain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDuration + 0.1);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.1);

      // Sub bass layer for depth
      const sub = this.ctx!.createOscillator();
      const subGain = this.ctx!.createGain();
      sub.type = 'sine';
      sub.frequency.value = freq / 2;
      sub.connect(subGain);
      subGain.connect(this.masterGain!);
      subGain.gain.setValueAtTime(0, noteStart);
      subGain.gain.linearRampToValueAtTime(0.2, noteStart + 0.05);
      subGain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDuration);
      sub.start(noteStart);
      sub.stop(noteStart + noteDuration);
    });

    // Final dramatic low rumble with pitch drop
    const rumbleStart = t + 0.2 + notes.length * noteDuration;

    // Deep bass drop
    const bassDrop = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassDrop.type = 'sine';
    bassDrop.frequency.setValueAtTime(80, rumbleStart);
    bassDrop.frequency.exponentialRampToValueAtTime(25, rumbleStart + 1.2);
    bassDrop.connect(bassGain);
    bassGain.connect(this.masterGain);
    bassGain.gain.setValueAtTime(0.5, rumbleStart);
    bassGain.gain.exponentialRampToValueAtTime(0.01, rumbleStart + 1.2);
    bassDrop.start(rumbleStart);
    bassDrop.stop(rumbleStart + 1.2);

    // Noise rumble
    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(300, rumbleStart);
    noiseFilter.frequency.exponentialRampToValueAtTime(50, rumbleStart + 1.0);

    const noiseGain = this.ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noiseGain.gain.setValueAtTime(0.4, rumbleStart);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, rumbleStart + 1.0);

    noise.start(rumbleStart);
    noise.stop(rumbleStart + 1.2);
  }
}