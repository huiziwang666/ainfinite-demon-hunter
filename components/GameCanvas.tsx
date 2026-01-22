import React, { useEffect, useRef, useCallback, useState } from 'react';
import { HandState, Point } from '../types';
import { AudioEngine } from '../services/audioService';

// Game constants
const MAX_LIVES = 3;
const VICTORY_KILLS = 30;
const DEMON_ESCAPE_TIME = 5000; // 5 seconds before demon escapes

// --- Configuration & Helpers ---

// Particle types for cartoon explosions
type ParticleType = 'core' | 'flame' | 'spark' | 'debris' | 'smoke' | 'shockwave' | 'glow' | 'trail';

const randomChoice = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// HSL color helper
const hsl = (h: number, s: number, l: number, a: number = 1) => {
  return `hsla(${h % 360}, ${Math.min(100, Math.max(0, s))}%, ${Math.min(100, Math.max(0, l))}%, ${a})`;
};

const MAX_PARTICLES = 800; // Reduced for performance

// --- Particle Class (from Gemini example, adapted) ---

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  lightness: number;
  alpha: number;
  decay: number;
  friction: number;
  gravity: number;
  size: number;
  type: ParticleType;
  angle: number;
  length: number;
  wobbleScale: number; // Pre-computed for performance

  constructor(x: number, y: number, hue: number, velocity: { x: number; y: number }, lightness: number = 55, size: number = 2, type: ParticleType = 'flame') {
    this.x = x;
    this.y = y;
    this.vx = velocity.x;
    this.vy = velocity.y;
    this.hue = hue;
    this.lightness = lightness;
    this.alpha = 1;
    this.decay = 0.04 + Math.random() * 0.03; // FASTER decay
    this.friction = 0.94;
    this.gravity = 0.05;
    this.size = size;
    this.type = type;
    this.angle = Math.atan2(velocity.y, velocity.x);
    this.length = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y) * 2;
    this.wobbleScale = 0.8 + Math.random() * 0.4; // Pre-compute wobble
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;

    const r = this.size * this.alpha;

    if (this.type === 'core') {
      // Bright white-yellow core with multiple layers
      ctx.fillStyle = `hsla(45, 100%, 95%, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Orange middle layer
      ctx.fillStyle = `hsla(35, 100%, 70%, ${this.alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 1.0, 0, Math.PI * 2);
      ctx.fill();
      // Pure white center
      ctx.fillStyle = `hsla(60, 100%, 100%, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'glow') {
      // Soft ambient glow - adds atmosphere
      ctx.fillStyle = `hsla(${this.hue}, 100%, 60%, ${this.alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spark') {
      // Fast streaking sparks with glowing trail
      const trailLength = this.length * (0.5 + this.alpha * 0.5);
      const startX = this.x - Math.cos(this.angle) * trailLength * 0.3;
      const startY = this.y - Math.sin(this.angle) * trailLength * 0.3;
      const endX = this.x + Math.cos(this.angle) * trailLength;
      const endY = this.y + Math.sin(this.angle) * trailLength;

      // Glowing trail (gradient from dim to bright)
      const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
      gradient.addColorStop(0, `hsla(${this.hue}, 100%, 50%, 0)`);
      gradient.addColorStop(0.5, `hsla(${this.hue}, 100%, 70%, ${this.alpha * 0.7})`);
      gradient.addColorStop(1, `hsla(${this.hue + 10}, 100%, 95%, ${this.alpha})`);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Bright white-hot tip
      ctx.fillStyle = `hsla(60, 100%, 100%, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'trail') {
      // Small trailing particles
      ctx.fillStyle = `hsla(${this.hue}, 100%, 80%, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'flame') {
      // Flame with darker edge for cartoon pop
      const flameR = r * this.wobbleScale;
      // Dark orange outline
      ctx.fillStyle = hsl(this.hue - 10, 100, Math.max(30, this.lightness - 25), this.alpha * 0.7);
      ctx.beginPath();
      ctx.arc(this.x, this.y, flameR * 1.15, 0, Math.PI * 2);
      ctx.fill();
      // Bright inner flame
      ctx.fillStyle = hsl(this.hue, 100, this.lightness, this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, flameR, 0, Math.PI * 2);
      ctx.fill();
      // Hot center highlight
      ctx.fillStyle = hsl(this.hue + 10, 100, Math.min(95, this.lightness + 20), this.alpha * 0.6);
      ctx.beginPath();
      ctx.arc(this.x, this.y, flameR * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'debris') {
      // Glowing debris with trail effect
      ctx.fillStyle = hsl(this.hue, 90, this.lightness, this.alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Bright center
      ctx.fillStyle = hsl(this.hue + 10, 100, 90, this.alpha * 0.8);
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'smoke') {
      // Dark smoke that rises - gray/brown tones with soft edges
      ctx.fillStyle = `rgba(50, 40, 35, ${this.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * this.wobbleScale * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(70, 55, 45, ${this.alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * this.wobbleScale * 0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'shockwave') {
      // Fast expanding shockwave ring
      const expansion = this.size * (1 - this.alpha) * 4 + 15;
      // Outer bright ring
      ctx.strokeStyle = `hsla(50, 100%, 95%, ${this.alpha * 0.9})`;
      ctx.lineWidth = 8 * this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, expansion, 0, Math.PI * 2);
      ctx.stroke();
      // Middle orange ring
      ctx.strokeStyle = `hsla(35, 100%, 70%, ${this.alpha * 0.7})`;
      ctx.lineWidth = 5 * this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, expansion * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      // Inner red ring
      ctx.strokeStyle = `hsla(15, 100%, 60%, ${this.alpha * 0.5})`;
      ctx.lineWidth = 3 * this.alpha;
      ctx.beginPath();
      ctx.arc(this.x, this.y, expansion * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  isDead() {
    return this.alpha <= 0;
  }
}

// --- Demon Class ---
const DEMON_COLORS = [
  { body: '#FF1744', eyes: '#FFEB3B', horns: '#7B1FA2' },  // Red demon
  { body: '#E91E63', eyes: '#00FF00', horns: '#4A148C' },  // Pink demon
  { body: '#9C27B0', eyes: '#FF5722', horns: '#1A237E' },  // Purple demon
  { body: '#F44336', eyes: '#FFFF00', horns: '#311B92' },  // Crimson demon
];

class Demon {
  x: number;
  y: number;
  size: number;
  colors: typeof DEMON_COLORS[0];
  spawnTime: number;
  wobble: number;
  wobbleSpeed: number;
  alpha: number;
  isDying: boolean;
  deathTime: number;
  mouthOpen: number;
  escaped: boolean;

  constructor(x: number, y: number, size: number = 80) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.colors = randomChoice(DEMON_COLORS);
    this.spawnTime = Date.now();
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.05 + Math.random() * 0.03;
    this.alpha = 0; // Fade in
    this.isDying = false;
    this.deathTime = 0;
    this.mouthOpen = 0;
    this.escaped = false;
  }

  // Check if demon has been alive too long and should escape
  shouldEscape(): boolean {
    return !this.isDying && !this.escaped && (Date.now() - this.spawnTime > DEMON_ESCAPE_TIME);
  }

  escape() {
    this.escaped = true;
    this.isDying = true; // Trigger fade out
  }

  update() {
    // Fade in animation
    if (!this.isDying && this.alpha < 1) {
      this.alpha = Math.min(1, this.alpha + 0.05);
    }

    // Death animation
    if (this.isDying) {
      this.alpha -= 0.1;
    }

    // Wobble animation
    this.wobble += this.wobbleSpeed;
    this.mouthOpen = Math.sin(this.wobble * 2) * 0.3 + 0.5;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;

    const s = this.size;
    const wobbleX = Math.sin(this.wobble) * 5;
    const wobbleY = Math.cos(this.wobble * 0.7) * 3;
    const x = this.x + wobbleX;
    const y = this.y + wobbleY;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    // Body (main head shape) - no shadowBlur for performance
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.5, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker shading on sides
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.25, y, s * 0.15, s * 0.4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.25, y, s * 0.15, s * 0.4, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Horns
    ctx.fillStyle = this.colors.horns;
    // Left horn
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y - s * 0.35);
    ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.8, x - s * 0.2, y - s * 0.7);
    ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.5, x - s * 0.25, y - s * 0.35);
    ctx.fill();
    // Right horn
    ctx.beginPath();
    ctx.moveTo(x + s * 0.35, y - s * 0.35);
    ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.8, x + s * 0.2, y - s * 0.7);
    ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.25, y - s * 0.35);
    ctx.fill();

    // Horn tips (brighter)
    ctx.fillStyle = '#E1BEE7';
    ctx.beginPath();
    ctx.arc(x - s * 0.35, y - s * 0.7, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.35, y - s * 0.7, s * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (bright color, no shadow for performance)
    ctx.fillStyle = this.colors.eyes;
    // Left eye
    ctx.beginPath();
    ctx.ellipse(x - s * 0.18, y - s * 0.1, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(x + s * 0.18, y - s * 0.1, s * 0.12, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - s * 0.18, y - s * 0.08, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + s * 0.18, y - s * 0.08, s * 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows (angry)
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.25);
    ctx.lineTo(x - s * 0.08, y - s * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y - s * 0.25);
    ctx.lineTo(x + s * 0.08, y - s * 0.32);
    ctx.stroke();

    // Mouth (big scary grin with fangs)
    const mouthHeight = s * 0.15 * this.mouthOpen;
    ctx.fillStyle = '#1A0000';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.25, s * 0.3, mouthHeight + s * 0.08, 0, 0, Math.PI);
    ctx.fill();

    // Teeth
    ctx.fillStyle = '#FFF';
    const teethCount = 7;
    for (let i = 0; i < teethCount; i++) {
      const tx = x - s * 0.25 + (i / (teethCount - 1)) * s * 0.5;
      const toothHeight = (i === 0 || i === teethCount - 1 || i === 3) ? s * 0.12 : s * 0.08;
      ctx.beginPath();
      ctx.moveTo(tx - s * 0.03, y + s * 0.18);
      ctx.lineTo(tx, y + s * 0.18 + toothHeight);
      ctx.lineTo(tx + s * 0.03, y + s * 0.18);
      ctx.fill();
    }

    // Tongue (if mouth open enough)
    if (this.mouthOpen > 0.4) {
      ctx.fillStyle = '#FF4081';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.35, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ears/side horns
    ctx.fillStyle = this.colors.body;
    ctx.beginPath();
    ctx.ellipse(x - s * 0.5, y, s * 0.1, s * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.5, y, s * 0.1, s * 0.2, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw escape timer bar (shows how close to escaping)
    if (!this.isDying) {
      const elapsed = Date.now() - this.spawnTime;
      const progress = Math.min(1, elapsed / DEMON_ESCAPE_TIME);
      const barWidth = s * 0.8;
      const barHeight = 6;
      const barX = x - barWidth / 2;
      const barY = y + s * 0.65;

      // Background bar (dark)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Progress bar (green -> yellow -> red)
      const hue = (1 - progress) * 120; // 120=green, 60=yellow, 0=red
      ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.fillRect(barX, barY, barWidth * progress, barHeight);

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    ctx.restore();
  }

  // Check if point is inside demon hitbox
  containsPoint(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < this.size * 0.6; // Hitbox radius
  }

  kill() {
    this.isDying = true;
    this.deathTime = Date.now();
  }

  isDead() {
    return this.isDying && this.alpha <= 0;
  }
}

// --- Component ---

const KPOP_TEXT_LINE1 = "AINFINITE DEMON HUNTER";
const KPOP_TEXT_LINE2 = "Idol Power Unleashed";

interface GameCanvasProps {
  onHandsDetected: (detected: boolean) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ onHandsDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);

  // Game State
  const particles = useRef<Particle[]>([]);
  const [lives, setLives] = useState(MAX_LIVES);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false);
  const victorySoundPlayed = useRef(false);
  const gameOverSoundPlayed = useRef(false);

  // Track debounce and hand state
  const handStateRef = useRef<{ [key: string]: HandState }>({ 'Left': HandState.UNKNOWN, 'Right': HandState.UNKNOWN });
  const prevHandStateRef = useRef<{ [key: string]: HandState }>({ 'Left': HandState.UNKNOWN, 'Right': HandState.UNKNOWN });
  const handPosRef = useRef<{ [key: string]: Point }>({ 'Left': {x:0,y:0}, 'Right': {x:0,y:0} });
  const lastTriggerTime = useRef<{ [key: string]: number }>({ 'Left': 0, 'Right': 0 });
  const grandFinaleRef = useRef<{ active: boolean; lastSpawn: number }>({ active: false, lastSpawn: 0 });

  // Demon spawning state
  const demons = useRef<Demon[]>([]);
  const lastDemonSpawn = useRef<number>(0);
  const killCount = useRef<number>(0);
  const livesRef = useRef<number>(MAX_LIVES); // Ref for use in draw loop

  // Screen shake effect
  const screenShake = useRef<{ intensity: number; duration: number; startTime: number }>({ intensity: 0, duration: 0, startTime: 0 });

  // Combo system
  const comboCount = useRef<number>(0);
  const lastKillTime = useRef<number>(0);
  const COMBO_TIMEOUT = 1500; // 1.5 seconds to maintain combo

  useEffect(() => {
    audioRef.current = new AudioEngine();

    // Load background image
    const bgImage = new Image();
    bgImage.src = '/Demon_realm.webp';
    bgImageRef.current = bgImage;

    // Load logo image
    const logo = new Image();
    logo.src = '/new-logo.png';
    logoRef.current = logo;

    // Start background music
    const bgMusic = new Audio('/energetic.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.5;
    bgMusic.play().catch(e => console.log('Audio autoplay blocked:', e));
    bgMusicRef.current = bgMusic;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const onResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', onResize);

    const initMediaPipe = async () => {
      const { Hands, Camera } = window as any;
      
      const hands = new Hands({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0, // Use lite model for faster tracking
        minDetectionConfidence: 0.5, // Lower threshold for better edge detection
        minTrackingConfidence: 0.4
      });

      hands.onResults(onResults);

      if (videoRef.current) {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 480, // Balance between speed and coverage
          height: 360
        });
        camera.start();
      }
    };

    initMediaPipe();

    const render = () => {
      draw();
      requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', onResize);
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  const onResults = useCallback((results: any) => {
    if (results.multiHandLandmarks && results.multiHandedness) {
      onHandsDetected(results.multiHandLandmarks.length > 0);
      const foundHands = new Set<string>();

      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const label = results.multiHandedness[i].label;
        foundHands.add(label);
        
        const wrist = landmarks[0];
        const tips = [8, 12, 16, 20];
        let avgDist = 0;
        
        tips.forEach(tipIdx => {
            const dx = landmarks[tipIdx].x - wrist.x;
            const dy = landmarks[tipIdx].y - wrist.y;
            avgDist += Math.sqrt(dx*dx + dy*dy);
        });
        avgDist /= 4;

        // Detection Logic: < 0.25 is fist, > 0.25 is open
        const newState = avgDist < 0.25 ? HandState.FIST : HandState.OPEN;
        
        handPosRef.current[label] = { x: wrist.x, y: wrist.y };
        handStateRef.current[label] = newState;
      }

      // Clear missing hands
      ['Left', 'Right'].forEach(hand => {
        if (!foundHands.has(hand)) {
          handStateRef.current[hand] = HandState.UNKNOWN;
        }
      });
    }
  }, [onHandsDetected]);

  // Spawn a demon at random position
  const spawnDemon = () => {
    if (!canvasRef.current) return;
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Keep demons away from edges and UI areas
    const margin = 150;
    const x = margin + Math.random() * (width - margin * 2);
    const y = margin + Math.random() * (height - margin * 2.5); // More margin at bottom for text

    // Random size variation
    const size = randomRange(70, 120);

    const demon = new Demon(x, y, size);
    demons.current.push(demon);
  };

  // Trigger screen shake
  const triggerScreenShake = (intensity: number, duration: number) => {
    screenShake.current = { intensity, duration, startTime: Date.now() };
  };

  // Kill demons near an explosion point
  const killDemonsNearPoint = (x: number, y: number, radius: number = 120) => {
    const now = Date.now();
    let killsThisFrame = 0;

    for (const demon of demons.current) {
      if (!demon.isDying) {
        const dx = x - demon.x;
        const dy = y - demon.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius + demon.size * 0.5) {
          demon.kill();
          killCount.current++;
          killsThisFrame++;

          // Update combo
          if (now - lastKillTime.current < COMBO_TIMEOUT) {
            comboCount.current++;
          } else {
            comboCount.current = 1;
          }
          lastKillTime.current = now;

          // Screen shake based on combo
          triggerScreenShake(8 + comboCount.current * 2, 150);
        }
      }
    }

    return killsThisFrame;
  };

  // Clear all demons (IDOL POWER attack)
  const clearAllDemons = () => {
    demons.current.forEach((demon: Demon) => {
      if (!demon.isDying) {
        demon.kill();
        triggerExplosion(demon.x, demon.y);
        killCount.current++;
      }
    });
  };

  // Check for victory condition
  const checkVictory = () => {
    if (killCount.current >= VICTORY_KILLS && !victory && !victorySoundPlayed.current) {
      victorySoundPlayed.current = true;
      setVictory(true);
      // Stop background music
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
      }
      // Play victory sound once
      audioRef.current?.playVictory();
    }
  };

  // Handle demon escape (lose a life)
  const handleDemonEscape = () => {
    livesRef.current--;
    setLives(livesRef.current);
    if (livesRef.current <= 0 && !gameOver && !gameOverSoundPlayed.current) {
      gameOverSoundPlayed.current = true;
      setGameOver(true);
      // Stop background music
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
      }
      // Play game over sound once
      audioRef.current?.playGameOver();
    }
  };

  // Restart the game
  const restartGame = () => {
    killCount.current = 0;
    livesRef.current = MAX_LIVES;
    setLives(MAX_LIVES);
    setGameOver(false);
    setVictory(false);
    victorySoundPlayed.current = false;
    gameOverSoundPlayed.current = false;
    demons.current = [];
    particles.current = [];
    lastDemonSpawn.current = 0;
    comboCount.current = 0;
    lastKillTime.current = 0;
    // Restart background music
    if (bgMusicRef.current) {
      bgMusicRef.current.currentTime = 0;
      bgMusicRef.current.play().catch(e => console.log('Audio play error:', e));
    }
  };

  const triggerExplosion = (x: number, y: number, scale: number = 1) => {
    if (!canvasRef.current) return;
    if (particles.current.length > MAX_PARTICLES) return;

    audioRef.current?.playExplosion(scale);

    // === EXPLOSIVE FLASH - instant bright burst (smaller, no white) ===
    const flashCore = new Particle(x, y, 40, { x: 0, y: 0 }, 85, 25 * scale, 'core');
    flashCore.decay = 0.15;
    flashCore.gravity = 0;
    flashCore.friction = 1;
    particles.current.push(flashCore);

    // Orange glow
    const glow = new Particle(x, y, 35, { x: 0, y: 0 }, 70, 40 * scale, 'glow');
    glow.decay = 0.1;
    glow.gravity = 0;
    glow.friction = 1;
    particles.current.push(glow);

    // === SPARK RAYS - smaller, faster ===
    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = randomRange(12, 22) * scale;
      const sparkHue = randomChoice([45, 40, 35, 30, 25, 20, 15]); // Orange to red
      const spark = new Particle(x, y, sparkHue, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      }, 80, 3, 'spark');
      spark.decay = 0.09;
      spark.gravity = 0.04;
      spark.friction = 0.94;
      spark.length = randomRange(20, 40);
      particles.current.push(spark);
    }

    // === FIRE BURST - compact flames ===
    // Inner flames (orange-yellow)
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(5, 10) * scale;
      const flame = new Particle(x, y, randomChoice([45, 40, 35]), {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      }, randomRange(65, 80), randomRange(15, 25) * scale, 'flame');
      flame.decay = 0.08;
      flame.gravity = -0.03;
      flame.friction = 0.9;
      particles.current.push(flame);
    }

    // Outer flames (orange-red)
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(8, 14) * scale;
      const hue = randomChoice([35, 30, 25, 20, 15, 10, 5]); // Orange to deep red
      const flame = new Particle(x, y, hue, {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      }, randomRange(55, 70), randomRange(12, 22) * scale, 'flame');
      flame.decay = 0.07;
      flame.gravity = randomRange(-0.02, 0.04);
      flame.friction = 0.91;
      particles.current.push(flame);
    }

    // === DEBRIS - hot embers ===
    const debrisCount = 10;
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(10, 20) * scale;
      const debris = new Particle(x, y, randomChoice([45, 35, 25, 15]), {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      }, randomRange(60, 80), randomRange(2, 5), 'debris');
      debris.decay = 0.05;
      debris.gravity = 0.12;
      debris.friction = 0.95;
      particles.current.push(debris);
    }

    // === TRAILING EMBERS ===
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(6, 12) * scale;
      const trail = new Particle(x, y, randomChoice([50, 40, 30, 20]), {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed
      }, 75, 3, 'trail');
      trail.decay = 0.06;
      trail.gravity = 0.06;
      trail.friction = 0.93;
      particles.current.push(trail);
    }

    // === SMOKE - smaller puffs ===
    for (let i = 0; i < 3; i++) {
      const offsetX = (Math.random() - 0.5) * 15;
      const offsetY = (Math.random() - 0.5) * 15;
      const smoke = new Particle(x + offsetX, y + offsetY, 20, {
        x: (Math.random() - 0.5) * 2,
        y: -0.5 - Math.random()
      }, 25, randomRange(15, 30) * scale, 'smoke');
      smoke.decay = 0.02;
      smoke.gravity = -0.04;
      smoke.friction = 0.97;
      particles.current.push(smoke);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const now = Date.now();

    // Apply screen shake
    ctx.save();
    if (screenShake.current.intensity > 0) {
      const elapsed = now - screenShake.current.startTime;
      if (elapsed < screenShake.current.duration) {
        const progress = elapsed / screenShake.current.duration;
        const currentIntensity = screenShake.current.intensity * (1 - progress);
        const shakeX = (Math.random() - 0.5) * currentIntensity * 2;
        const shakeY = (Math.random() - 0.5) * currentIntensity * 2;
        ctx.translate(shakeX, shakeY);
      } else {
        screenShake.current.intensity = 0;
      }
    }

    // Reset combo if timeout
    if (now - lastKillTime.current > COMBO_TIMEOUT) {
      comboCount.current = 0;
    }

    // 1. Trail fade effect - faster for snappier feel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw background image (with low opacity to show through trails)
    // Crop out more of the ocean by extending image below canvas
    ctx.globalCompositeOperation = 'source-over';
    if (bgImageRef.current && bgImageRef.current.complete) {
      ctx.globalAlpha = 0.15;
      const imageHeight = height * 1.35; // Extend 35% below canvas to crop ocean
      ctx.drawImage(bgImageRef.current, 0, 0, width, imageHeight);
      ctx.globalAlpha = 1;
    }

    // Responsive scaling factor based on screen size
    const scale = Math.min(width / 1920, height / 1080);
    const minScale = Math.max(0.5, scale);

    // 3. Logo and branding - top left (K-pop neon style)
    if (logoRef.current && logoRef.current.complete) {
      ctx.save();
      const logoSize = Math.max(50, 80 * minScale);
      const logoMargin = Math.max(20, 30 * minScale);
      ctx.drawImage(logoRef.current, logoMargin, logoMargin, logoSize, logoSize);
      ctx.font = `bold ${Math.max(28, Math.floor(48 * minScale))}px "Cinzel", serif`;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FF69B4';
      ctx.fillText('AInfinite', logoMargin + logoSize + 15, logoMargin + logoSize * 0.7);
      ctx.restore();
    }

    // 4. Text - K-pop neon styling - bottom right (no shadow for performance)
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#00FFFF';
    const margin = Math.max(10, 20 * minScale);

    // Responsive font sizes - smaller on mobile for line 2 only
    const isMobile = width < 768;
    const line1FontSize = Math.max(20, Math.floor(36 * minScale));
    const line2FontSize = isMobile ? Math.max(12, Math.floor(14 * minScale)) : Math.max(14, Math.floor(26 * minScale));
    const lineSpacing = isMobile ? Math.max(18, 22 * minScale) : Math.max(25, 35 * minScale);

    ctx.font = `bold ${line1FontSize}px "Cinzel", serif`;
    ctx.fillText(KPOP_TEXT_LINE1, width - margin, height - margin - lineSpacing);
    ctx.font = `bold ${line2FontSize}px "Cinzel", serif`;
    ctx.fillText(KPOP_TEXT_LINE2, width - margin, height - margin);
    ctx.restore();

    // 4. Switch to lighter blend for particles
    ctx.globalCompositeOperation = 'lighter';

    // 5. Input Logic (Hand gesture detection)
    const leftState = handStateRef.current['Left'];
    const rightState = handStateRef.current['Right'];

    // Check for Grand Finale mode (both hands open) - only when game is active
    const bothHandsOpen = !gameOver && !victory && leftState === HandState.OPEN && rightState === HandState.OPEN;
    grandFinaleRef.current.active = bothHandsOpen;

    // Ultimate Attack: SPECTACULAR explosions show (only when game is active)
    if (bothHandsOpen && now - grandFinaleRef.current.lastSpawn > 15) {
      const phase = Math.floor(now / 400) % 6; // Faster cycle through more patterns

      // Pattern 1: Symmetrical bursts from sides
      if (phase === 0) {
        const y = Math.random() * height * 0.5 + height * 0.15;
        triggerExplosion(width * 0.1, y);
        triggerExplosion(width * 0.9, y);
        triggerExplosion(width * 0.3, y - 30);
        triggerExplosion(width * 0.7, y - 30);
        triggerExplosion(width * 0.5, y - 60);
      }
      // Pattern 2: Rising wave
      else if (phase === 1) {
        for (let i = 0; i < 6; i++) {
          const x = (Math.random() * 0.8 + 0.1) * width;
          const y = Math.random() * height * 0.5 + height * 0.1;
          triggerExplosion(x, y);
        }
      }
      // Pattern 3: Center explosion cascade
      else if (phase === 2) {
        const centerX = width / 2 + (Math.random() - 0.5) * 200;
        const centerY = height * 0.3 + (Math.random() - 0.5) * 100;
        triggerExplosion(centerX, centerY);
        triggerExplosion(centerX - 150, centerY + 80);
        triggerExplosion(centerX + 150, centerY + 80);
        triggerExplosion(centerX - 100, centerY - 50);
        triggerExplosion(centerX + 100, centerY - 50);
      }
      // Pattern 4: Diagonal cross
      else if (phase === 3) {
        triggerExplosion(width * 0.15, height * 0.15);
        triggerExplosion(width * 0.85, height * 0.15);
        triggerExplosion(width * 0.5, height * 0.35);
        triggerExplosion(width * 0.15, height * 0.55);
        triggerExplosion(width * 0.85, height * 0.55);
        triggerExplosion(width * 0.3, height * 0.25);
        triggerExplosion(width * 0.7, height * 0.25);
      }
      // Pattern 5: Circle burst
      else if (phase === 4) {
        const cx = width / 2;
        const cy = height * 0.4;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 200;
          triggerExplosion(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);
        }
      }
      // Pattern 6: Random chaos explosion
      else {
        for (let i = 0; i < 8; i++) {
          const randX = Math.random() * width;
          const randY = Math.random() * height * 0.7 + height * 0.1;
          triggerExplosion(randX, randY);
        }
      }
      grandFinaleRef.current.lastSpawn = now;
    }

    // Draw spectacular "IDOL POWER" text when active (K-pop style)
    if (bothHandsOpen) {
      ctx.globalCompositeOperation = 'source-over';

      // Pulsing background flash - pink/purple K-pop glow
      const pulse = Math.sin(now / 100) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, ${100 + pulse * 50}, ${200 + pulse * 55}, ${0.03 + pulse * 0.02})`;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      // Pulsing text size - responsive
      const textScale = 1 + Math.sin(now / 150) * 0.1;
      const baseFontSize = Math.max(36, Math.floor(72 * minScale));
      const fontSize = Math.floor(baseFontSize * textScale);
      ctx.font = `bold ${fontSize}px "Cinzel", serif`;
      ctx.textAlign = 'center';

      // Pink-purple-cyan cycling with neon glow
      const hueShift = (now / 20) % 120 + 280; // Cycles through pink-purple-cyan range
      ctx.fillStyle = `hsl(${hueShift % 360}, 100%, 70%)`;
      ctx.shadowColor = `hsl(${(hueShift + 60) % 360}, 100%, 60%)`;
      ctx.shadowBlur = (35 + Math.sin(now / 100) * 20) * minScale;

      const textY = height * 0.35;
      ctx.fillText('IDOL POWER!', width / 2, textY);

      // Secondary neon glow layer
      ctx.shadowColor = '#FF69B4';
      ctx.shadowBlur = 25 * minScale;
      ctx.fillText('IDOL POWER!', width / 2, textY);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
    }

    // === DEMON SYSTEM ===
    ctx.globalCompositeOperation = 'source-over';

    // Spawn new demons periodically (only if game is active)
    if (!gameOver && !victory) {
      const spawnInterval = Math.max(800, 2000 - killCount.current * 20); // Gets faster as you kill more
      if (now - lastDemonSpawn.current > spawnInterval && demons.current.length < 8) {
        spawnDemon();
        lastDemonSpawn.current = now;
      }
    }

    // Clear all demons when IDOL POWER is active (only if game is active)
    if (!gameOver && !victory && bothHandsOpen && demons.current.some((d: Demon) => !d.isDying)) {
      clearAllDemons();
    }

    // Update and draw demons
    let demonWriteIdx = 0;
    for (let i = 0; i < demons.current.length; i++) {
      const demon = demons.current[i];

      // Only update game logic if game is active
      if (!gameOver && !victory) {
        // Check if demon should escape (alive too long)
        if (demon.shouldEscape()) {
          demon.escape();
          handleDemonEscape();
        }
        demon.update();
      }

      demon.draw(ctx);
      if (!demon.isDead()) {
        demons.current[demonWriteIdx++] = demon;
      }
    }
    demons.current.length = demonWriteIdx;

    // Check victory condition
    checkVictory();

    // Draw kill counter and progress
    ctx.save();
    ctx.font = `bold ${Math.max(18, Math.floor(24 * minScale))}px "Cinzel", serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`DEMONS SLAIN: ${killCount.current} / ${VICTORY_KILLS}`, 30, height - 30);

    // Draw combo counter if active
    if (comboCount.current > 1 && now - lastKillTime.current < COMBO_TIMEOUT) {
      const comboAlpha = Math.min(1, (COMBO_TIMEOUT - (now - lastKillTime.current)) / 500);
      const comboScale = 1 + Math.sin(now / 80) * 0.1;
      ctx.save();
      ctx.globalAlpha = comboAlpha;
      ctx.font = `bold ${Math.floor(36 * minScale * comboScale)}px "Cinzel", serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = comboCount.current >= 5 ? '#FFD700' : comboCount.current >= 3 ? '#FF69B4' : '#00FFFF';
      ctx.fillText(`${comboCount.current}x COMBO!`, width / 2, height * 0.15);
      ctx.restore();
    }
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';

    // Normal hand tracking
    ['Left', 'Right'].forEach(hand => {
      const state = handStateRef.current[hand];
      const pos = handPosRef.current[hand];

      // Expand coordinate range to reach screen edges (camera doesn't capture full 0-1 range)
      // Map 0.1-0.9 camera range to 0-1 screen range
      const expandedX = Math.max(0, Math.min(1, (pos.x - 0.1) / 0.8));
      const expandedY = Math.max(0, Math.min(1, (pos.y - 0.05) / 0.9));

      const screenX = (1 - expandedX) * width; // Mirror X
      const screenY = expandedY * height;

      // Draw Hand Indicator - Pink when open, Purple pulsing when fist (charging)
      if (state !== HandState.UNKNOWN) {
          const baseSize = bothHandsOpen ? 22 : 18;

          if (state === HandState.FIST) {
            // Pulsing charge effect when fist is made
            const pulse = Math.sin(now / 60) * 0.3 + 1;
            const chargeSize = baseSize * pulse;

            // Outer glow ring
            ctx.beginPath();
            ctx.arc(screenX, screenY, chargeSize + 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${0.2 + Math.sin(now / 80) * 0.1})`;
            ctx.fill();

            // Main cursor
            ctx.beginPath();
            ctx.arc(screenX, screenY, chargeSize, 0, Math.PI * 2);
            ctx.fillStyle = '#A855F7';
            ctx.fill();

            // Inner bright core
            ctx.beginPath();
            ctx.arc(screenX, screenY, chargeSize * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#E879F9';
            ctx.fill();
          } else {
            // Open hand - ready state
            ctx.beginPath();
            ctx.arc(screenX, screenY, baseSize, 0, Math.PI * 2);
            ctx.fillStyle = '#FF69B4';
            ctx.fill();
          }

          // White outline for visibility
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(screenX, screenY, state === HandState.FIST ? baseSize * (Math.sin(now / 60) * 0.3 + 1) : baseSize, 0, Math.PI * 2);
          ctx.stroke();
      }

      // Normal trigger (only when NOT in grand finale and game is active)
      if (!bothHandsOpen && !gameOver && !victory) {
        const prevState = prevHandStateRef.current[hand];
        const justOpened = state === HandState.OPEN && prevState !== HandState.OPEN;
        if (justOpened && now - lastTriggerTime.current[hand] > 250) {
          triggerExplosion(screenX, screenY);
          killDemonsNearPoint(screenX, screenY, 120); // Kill demons near explosion
          lastTriggerTime.current[hand] = now;
        }
      }
      prevHandStateRef.current[hand] = state;
    });

    // 6. Update and draw particles (in-place cleanup)
    let writeIdx = 0;
    for (let i = 0; i < particles.current.length; i++) {
      const p = particles.current[i];
      p.update();
      p.draw(ctx);
      if (!p.isDead()) {
        particles.current[writeIdx++] = p;
      }
    }
    particles.current.length = writeIdx;

    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';

    // Restore from screen shake
    ctx.restore();
  };

  return (
    <>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-none"
      />

      {/* Lives display */}
      <div className="absolute top-4 right-4 flex gap-2">
        {Array.from({ length: MAX_LIVES }).map((_, i) => (
          <span
            key={i}
            className={`text-3xl ${i < lives ? 'opacity-100' : 'opacity-30'}`}
          >
            💜
          </span>
        ))}
      </div>

      {/* Game Over Screen */}
      {gameOver && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="text-center p-8 border-2 border-red-500/60 rounded-3xl bg-red-950/60 backdrop-blur-md max-w-lg shadow-[0_0_100px_rgba(239,68,68,0.4)]">
            <h1 className="text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-500 to-red-600 mb-4 animate-pulse">
              GAME OVER
            </h1>
            <p className="text-2xl text-pink-300 mb-2">The demons have escaped!</p>
            <p className="text-xl text-cyan-400 mb-8">Demons Slain: {killCount.current}</p>
            <button
              onClick={restartGame}
              className="px-8 py-4 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500 text-white font-bold text-xl rounded-full hover:from-red-400 hover:via-pink-400 hover:to-purple-400 transform hover:scale-110 transition-all shadow-[0_0_40px_rgba(239,68,68,0.6)] border border-pink-300/50"
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Victory Screen */}
      {victory && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="text-center p-8 border-2 border-pink-400/60 rounded-3xl bg-purple-950/60 backdrop-blur-md max-w-lg shadow-[0_0_100px_rgba(236,72,153,0.4),0_0_60px_rgba(139,92,246,0.3)]">
            <h1 className="text-5xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-400 mb-4 animate-pulse">
              VICTORY!
            </h1>
            <p className="text-2xl text-cyan-300 mb-2">You are the Ultimate Idol!</p>
            <p className="text-xl text-pink-400 mb-2">Demons Slain: {killCount.current}</p>
            <p className="text-lg text-purple-300 mb-8">Lives Remaining: {lives}</p>
            <button
              onClick={restartGame}
              className="px-8 py-4 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white font-bold text-xl rounded-full hover:from-pink-400 hover:via-fuchsia-400 hover:to-purple-400 transform hover:scale-110 transition-all shadow-[0_0_40px_rgba(236,72,153,0.6)] border border-pink-300/50"
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GameCanvas;