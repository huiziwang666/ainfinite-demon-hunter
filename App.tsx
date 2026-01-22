import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';

// Preload images helper
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

const App = () => {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsPreloaded, setAssetsPreloaded] = useState(false);

  // Preload assets on mount
  useEffect(() => {
    const preloadAssets = async () => {
      try {
        await Promise.all([
          preloadImage('/new-logo.png'),
          preloadImage('/Demon_realm.webp'),
        ]);
        setAssetsPreloaded(true);
      } catch (e) {
        console.log('Asset preload error:', e);
        setAssetsPreloaded(true); // Continue anyway
      }
    };
    preloadAssets();
  }, []);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      setLoadingStatus('Requesting camera...');
      await navigator.mediaDevices.getUserMedia({ video: true });

      setLoadingStatus('Initializing audio...');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      if(ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Ensure assets are loaded
      if (!assetsPreloaded) {
        setLoadingStatus('Loading assets...');
        await Promise.all([
          preloadImage('/new-logo.png'),
          preloadImage('/Demon_realm.webp'),
        ]);
      }

      setLoadingStatus('Starting...');

      // Request fullscreen
      try {
        await document.documentElement.requestFullscreen();
      } catch (e) {
        console.log('Fullscreen not supported or denied');
      }

      setStarted(true);
    } catch (err) {
      console.error(err);
      setError("Camera access denied. Please allow camera access to play.");
    } finally {
      setLoading(false);
    }
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-pink-300 font-sans relative overflow-hidden">
        {/* Animated K-pop neon background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-950 via-fuchsia-950/50 to-black opacity-95"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-500/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent"></div>

        <div className="relative z-10 text-center p-8 border-2 border-pink-400/40 rounded-3xl bg-purple-950/60 backdrop-blur-md max-w-lg shadow-[0_0_100px_rgba(236,72,153,0.4),0_0_40px_rgba(139,92,246,0.3)]">
          <div className="flex flex-col items-center mb-6">
            <img src="/new-logo.png" alt="K-pop Logo" className="w-20 h-20 object-contain mb-3 drop-shadow-[0_0_15px_rgba(236,72,153,0.8)]" />
            <h1 className="text-4xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-fuchsia-400 to-cyan-400 drop-shadow-lg animate-pulse">
              AINFINITE DEMON HUNTER
            </h1>
          </div>
          <h2 className="text-2xl mb-2 text-cyan-300/90 tracking-[0.3em] font-bold">SLAY THE DEMONS</h2>
          <h3 className="text-lg mb-8 text-pink-300/70 tracking-wider">Idol Power Unleashed</h3>

          <div className="space-y-6 mb-8 text-lg text-purple-100">
            <div className="flex items-center justify-center space-x-4">
              <span className="text-3xl">💜</span>
              <p>Make a <span className="text-cyan-400 font-bold">Fist</span> then <span className="text-pink-400 font-bold">Open</span> to attack!</p>
              <span className="text-3xl">✨</span>
            </div>
            <p className="text-sm text-fuchsia-300/60">Channel your inner idol energy!</p>
          </div>

          {error && (
             <div className="mb-4 p-3 bg-pink-900/50 border border-pink-500 text-pink-200 rounded-xl">
               {error}
             </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="px-10 py-4 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 text-white font-bold text-xl rounded-full hover:from-pink-400 hover:via-fuchsia-400 hover:to-purple-400 transform hover:scale-110 transition-all shadow-[0_0_40px_rgba(236,72,153,0.6)] border border-pink-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? loadingStatus || "Loading..." : "START PERFORMANCE"}
          </button>

          <p className="mt-6 text-xs text-purple-400/40 font-mono tracking-wider">CAMERA FEED PROCESSED LOCALLY</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <GameCanvas onHandsDetected={setCameraActive} />
      
      {!cameraActive && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-cyan-500/80 text-xl font-mono animate-pulse tracking-widest">
          WAITING FOR HAND SIGNAL...
        </div>
      )}
    </div>
  );
};

export default App;