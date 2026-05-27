import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Fish, Sprout, Sparkles, Timer, Check, Ban, ArrowRight } from 'lucide-react';

// Static "how-to-play" banner shown above the live Fishland challenge so the
// player sees exactly what success and failure look like before tapping.
const FishHowToBanner = () => (
  <div className="mb-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700 mb-2">How to play</p>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <div className="relative h-10 rounded-md bg-gradient-to-b from-cyan-100 to-sky-200 overflow-hidden border border-cyan-300">
          <div className="absolute top-0 bottom-0 left-[36%] w-[28%] bg-emerald-300/60 border-x-2 border-emerald-500" />
          <div className="absolute top-1/2 -translate-y-1/2 left-[44%] text-xl">🐟</div>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
          <Check size={11} /> Tap = catch
        </p>
      </div>
      <div>
        <div className="relative h-10 rounded-md bg-gradient-to-b from-cyan-100 to-sky-200 overflow-hidden border border-cyan-300">
          <div className="absolute top-0 bottom-0 left-[36%] w-[28%] bg-emerald-300/60 border-x-2 border-emerald-500" />
          <div className="absolute top-1/2 -translate-y-1/2 left-[5%] text-xl">🐟</div>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-600">
          <Ban size={11} /> Tap = miss
        </p>
      </div>
    </div>
  </div>
);

// Static "how-to-play" banner for Farmland showing the four growth stages and
// pointing at the one stage the player is allowed to tap.
const PlantHowToBanner = () => (
  <div className="mb-3 rounded-xl border border-lime-200 bg-lime-50/70 p-3">
    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">How to play</p>
    <div className="flex items-center justify-between">
      {['🌱', '🌿', '🌾', '🌻'].map((s, i, arr) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl border ${
              i === 3
                ? 'border-emerald-500 bg-emerald-100 shadow-md shadow-emerald-200'
                : 'border-white bg-white/80'
            }`}
          >
            {s}
          </div>
          {i < arr.length - 1 && <ArrowRight size={12} className="mx-0.5 text-gray-400" />}
        </div>
      ))}
    </div>
    <p className="mt-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
      <Check size={11} /> Tap only when the plot shows 🌻 (the last stage)
    </p>
  </div>
);

const ROUND_MS = 8000;

const FishCatchChallenge = ({ level, onResult }) => {
  const [pos, setPos] = useState(0);
  const [dir, setDir] = useState(1);
  const [remaining, setRemaining] = useState(ROUND_MS);
  const speed = 0.45 + level * 0.18;
  const zoneWidth = Math.max(14, 32 - level * 3);
  const zoneStart = 50 - zoneWidth / 2;
  const zoneEnd = 50 + zoneWidth / 2;
  const lastTickRef = useRef(null);
  const rafRef = useRef(null);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const resolvedRef = useRef(false);

  useEffect(() => {
    lastTickRef.current = performance.now();
    const tick = (now) => {
      const dt = now - lastTickRef.current;
      lastTickRef.current = now;
      let next = posRef.current + dirRef.current * speed * (dt / 16);
      if (next >= 100) { next = 100; dirRef.current = -1; setDir(-1); }
      if (next <= 0) { next = 0; dirRef.current = 1; setDir(1); }
      posRef.current = next;
      setPos(next);
      setRemaining((r) => {
        const updated = Math.max(0, r - dt);
        if (updated <= 0 && !resolvedRef.current) {
          resolvedRef.current = true;
          onResult({ ok: false, reason: 'timeout' });
        }
        return updated;
      });
      if (!resolvedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, onResult]);

  const handleCast = () => {
    if (resolvedRef.current) return;
    const inside = posRef.current >= zoneStart && posRef.current <= zoneEnd;
    resolvedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onResult({ ok: inside, reason: inside ? 'caught' : 'missed' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Catch the Fish</p>
        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
          <Timer size={12} /> {(remaining / 1000).toFixed(1)}s
        </span>
      </div>

      <FishHowToBanner />

      <div className="relative h-40 rounded-2xl bg-gradient-to-b from-cyan-100 via-sky-100 to-blue-200 overflow-hidden border-2 border-cyan-200">
        <div
          className="absolute top-0 bottom-0 bg-emerald-300/50 border-x-2 border-emerald-500"
          style={{ left: `${zoneStart}%`, width: `${zoneWidth}%` }}
        />
        <div
          className="absolute top-1/2 text-4xl select-none"
          style={{ left: `calc(${pos}% - 18px)`, transform: `translateY(-50%) scaleX(${dir})` }}
        >
          🐟
        </div>
        <div className="absolute bottom-2 left-3 right-3 text-[10px] font-bold uppercase tracking-widest text-gray-700/70">
          Tap when the fish is in the green zone
        </div>
      </div>

      <button
        onClick={handleCast}
        className="mt-5 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
      >
        <Fish size={16} /> Cast Net
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500">
        <div>Speed: {speed.toFixed(2)}x</div>
        <div className="text-right">Zone: {zoneWidth.toFixed(0)}%</div>
      </div>
    </div>
  );
};

const STAGES = ['🌱', '🌿', '🌾', '🌻'];
const RIPE_STAGE = 3;

const RipePlantChallenge = ({ level, onResult }) => {
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [tick, setTick] = useState(0);
  const plotCount = 6;
  const cycleMs = Math.max(280, 700 - level * 80);
  const ripeWindowMs = Math.max(180, 380 - level * 35);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  const resolvedRef = useRef(false);

  // Lazy useState init so Math.random runs exactly once outside render.
  const [plots] = useState(() =>
    Array.from({ length: plotCount }, () => ({
      offset: Math.floor(Math.random() * STAGES.length),
      phase: Math.random() * cycleMs,
    })),
  );

  useEffect(() => {
    startRef.current = performance.now();
    const loop = (now) => {
      const elapsed = now - startRef.current;
      setTick(elapsed);
      const left = Math.max(0, ROUND_MS - elapsed);
      setRemaining(left);
      if (left <= 0 && !resolvedRef.current) {
        resolvedRef.current = true;
        onResult({ ok: false, reason: 'timeout' });
        return;
      }
      if (!resolvedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onResult]);

  const stageFor = (plot) => {
    const t = (tick + plot.phase) / cycleMs;
    return (Math.floor(t) + plot.offset) % STAGES.length;
  };

  const inRipeWindowFor = (plot) => {
    const t = (tick + plot.phase) / cycleMs;
    const frac = t - Math.floor(t);
    const stageIdx = (Math.floor(t) + plot.offset) % STAGES.length;
    if (stageIdx !== RIPE_STAGE) return false;
    return frac * cycleMs <= ripeWindowMs;
  };

  const handlePlot = (idx) => {
    if (resolvedRef.current) return;
    const plot = plots[idx];
    const ok = inRipeWindowFor(plot);
    resolvedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onResult({ ok, reason: ok ? 'harvested' : 'unripe' });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Pick the Ripe Plant</p>
        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
          <Timer size={12} /> {(remaining / 1000).toFixed(1)}s
        </span>
      </div>

      <PlantHowToBanner />

      <div className="rounded-2xl bg-gradient-to-b from-amber-100 via-lime-100 to-emerald-200 border-2 border-lime-200 p-4">
        <div className="grid grid-cols-3 gap-3">
          {plots.map((plot, idx) => {
            const stage = stageFor(plot);
            const ripe = stage === RIPE_STAGE;
            return (
              <button
                key={idx}
                onClick={() => handlePlot(idx)}
                className={`aspect-square rounded-xl text-4xl flex items-center justify-center border-2 transition-all ${
                  ripe ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-200' : 'border-white/60 bg-white/40 hover:bg-white/70'
                }`}
              >
                {STAGES[stage]}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700/70 mt-3 text-center">
          Tap a plot only when it shows 🌻
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-500">
        <div>Cycle: {cycleMs}ms</div>
        <div className="text-right">Ripe window: {ripeWindowMs}ms</div>
      </div>
    </div>
  );
};

const SkillChallengeModal = ({ open, gameType, level, onClose, onSuccess }) => {
  // Reset phase/result during render when the modal (re-)opens.
  // Effects-with-setState are linted out by this repo's React 19 rules, so
  // we use the recommended "compare prev prop in render" pattern instead.
  const [phase, setPhase] = useState('playing');
  const [result, setResult] = useState(null);
  const [openSig, setOpenSig] = useState(open ? `${gameType}` : null);
  const currentSig = open ? `${gameType}-${level}` : null;
  if (open && openSig !== currentSig) {
    setOpenSig(currentSig);
    setPhase('playing');
    setResult(null);
  }
  if (!open && openSig !== null) {
    setOpenSig(null);
  }

  const handleResult = (r) => {
    setResult(r);
    setPhase('result');
    if (r.ok) {
      setTimeout(() => {
        onSuccess();
      }, 600);
    }
  };

  const meta =
    gameType === 'FISHLAND'
      ? { title: 'Fishland Challenge', Icon: Fish, accent: 'text-cyan-600' }
      : { title: 'Farmland Challenge', Icon: Sprout, accent: 'text-emerald-600' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25 }}
            className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center ${meta.accent}`}>
                <meta.Icon size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{meta.title}</h3>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Level {level} — succeed to earn this action
                </p>
              </div>
            </div>

            {phase === 'playing' && gameType === 'FISHLAND' && (
              <FishCatchChallenge level={level} onResult={handleResult} />
            )}
            {phase === 'playing' && gameType === 'FARMLAND' && (
              <RipePlantChallenge level={level} onResult={handleResult} />
            )}

            {phase === 'result' && result && (
              <div className="py-8 text-center">
                <div className="text-6xl mb-3">{result.ok ? '🎉' : '😅'}</div>
                <p className={`font-black uppercase tracking-widest text-sm ${result.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {result.ok ? 'Nice catch!' : result.reason === 'timeout' ? 'Time up' : 'Missed it'}
                </p>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  {result.ok ? 'Action earned — adding +1 point...' : 'No point this time. Try again!'}
                </p>
                {!result.ok && (
                  <button
                    onClick={onClose}
                    className="mt-5 px-6 py-3 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-black transition-all"
                  >
                    Close
                  </button>
                )}
              </div>
            )}

            <p className="mt-4 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1">
              <Sparkles size={10} /> Difficulty rises with each level
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SkillChallengeModal;
