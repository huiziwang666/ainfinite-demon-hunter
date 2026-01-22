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

    // Triumphant ascending fanfare
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    const noteDuration = 0.15;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      osc.connect(gain);
      gain.connect(this.masterGain!);

      const noteStart = t + i * noteDuration;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.4, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDuration + 0.3);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.3);
    });

    // Final chord
    const chordFreqs = [523, 659, 784, 1047];
    chordFreqs.forEach(freq => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      osc.connect(gain);
      gain.connect(this.masterGain!);

      const chordStart = t + notes.length * noteDuration;
      gain.gain.setValueAtTime(0, chordStart);
      gain.gain.linearRampToValueAtTime(0.3, chordStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, chordStart + 1.5);

      osc.start(chordStart);
      osc.stop(chordStart + 1.5);
    });
  }

  public playGameOver() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Sad descending notes
    const notes = [392, 349, 311, 262]; // G4, F4, Eb4, C4
    const noteDuration = 0.25;

    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.value = freq;

      osc.connect(gain);
      gain.connect(this.masterGain!);

      const noteStart = t + i * noteDuration;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.35, noteStart + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + noteDuration + 0.2);

      osc.start(noteStart);
      osc.stop(noteStart + noteDuration + 0.2);
    });

    // Low rumble at the end
    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 0.8;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;

    const gain = this.ctx.createGain();
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    const rumbleStart = t + notes.length * noteDuration;
    gain.gain.setValueAtTime(0.5, rumbleStart);
    gain.gain.exponentialRampToValueAtTime(0.01, rumbleStart + 0.8);

    noise.start(rumbleStart);
    noise.stop(rumbleStart + 0.8);
  }
}