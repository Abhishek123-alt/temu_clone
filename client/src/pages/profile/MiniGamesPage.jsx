import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fish, Sprout, Sparkles, Gift, RefreshCw, Gamepad2, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { gamificationService } from '../../services/gamificationService';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { toast } from '../../utils/toast';
import SkillChallengeModal from '../../components/gamification/SkillChallengeModal';

const GAME_META = {
  FISHLAND: {
    title: 'Fishland',
    tagline: 'Feed your fish to grow it. Reach level 5 and unlock a real reward.',
    actionLabel: 'Feed Fish',
    accent: 'from-cyan-50 to-blue-50',
    border: 'border-cyan-200',
    chip: 'bg-cyan-100 text-cyan-700',
    button: 'bg-cyan-600 hover:bg-cyan-700',
    icon: Fish,
    stageEmoji: ['🐟', '🐠', '🐡', '🦈', '🐋'],
    bg: 'bg-gradient-to-br from-cyan-100 via-sky-50 to-blue-100',
  },
  FARMLAND: {
    title: 'Farmland',
    tagline: 'Water your plant daily to make it grow. Harvest gives you a coupon.',
    actionLabel: 'Water Plant',
    accent: 'from-lime-50 to-amber-50',
    border: 'border-lime-200',
    chip: 'bg-lime-100 text-lime-700',
    button: 'bg-emerald-600 hover:bg-emerald-700',
    icon: Sprout,
    stageEmoji: ['🌱', '🌿', '🌾', '🌻', '🌳'],
    bg: 'bg-gradient-to-br from-lime-100 via-emerald-50 to-amber-100',
  },
};

const GameCard = ({ state, onActionComplete }) => {
  const meta = GAME_META[state.game_type] || GAME_META.FISHLAND;
  const Icon = meta.icon;
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const stageIdx = Math.min(state.level - 1, meta.stageEmoji.length - 1);
  const progressPct = state.is_completed
    ? 100
    : Math.min((state.points / state.points_per_level) * 100, 100);

  const submitAction = async () => {
    setBusy(true);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
    try {
      const res = await gamificationService.playGame(state.game_type);
      onActionComplete(res);
      if (res.completed_just_now) {
        confetti({
          particleCount: 200,
          spread: 110,
          origin: { y: 0.5 },
          colors: ['#fb7701', '#22c55e', '#06b6d4', '#fbbf24'],
        });
        toast.success(`${meta.title} complete! ${res.reward_value} reward unlocked.`);
      } else if (res.leveled_up) {
        toast.success(`Leveled up to ${res.state.level}!`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAction = () => {
    if (busy || state.is_completed || state.actions_today >= state.actions_daily_cap) return;
    setChallengeOpen(true);
  };

  const handleChallengeSuccess = () => {
    setChallengeOpen(false);
    submitAction();
  };

  const handleReset = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await gamificationService.resetGame(state.game_type);
      onActionComplete({ state: fresh });
      toast.success(`${meta.title} started over!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not reset');
    } finally {
      setBusy(false);
    }
  };

  const dailyCapReached = state.actions_today >= state.actions_daily_cap;
  const disabled = busy || state.is_completed || dailyCapReached;

  return (
    <div className={`rounded-[32px] border-2 ${meta.border} ${meta.bg} p-8 shadow-sm relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${meta.chip}`}>
            <Icon size={26} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-gray-900">{meta.title}</h3>
            <p className="text-xs text-gray-600 font-medium max-w-xs">{meta.tagline}</p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest bg-white/70 backdrop-blur px-3 py-1 rounded-full text-gray-700">
          Lv {state.level} / {state.max_level}
        </span>
      </div>

      {/* The "creature" stage */}
      <div className="flex justify-center my-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${state.game_type}-${stageIdx}-${pulse}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: pulse ? 1.2 : 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="text-8xl select-none"
          >
            {state.is_completed ? '🏆' : meta.stageEmoji[stageIdx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-end text-xs font-bold text-gray-600 mb-1">
          <span>{state.is_completed ? 'Completed' : `Level ${state.level} progress`}</span>
          <span>
            {state.is_completed
              ? `${state.points_per_level}/${state.points_per_level}`
              : `${state.points}/${state.points_per_level}`}
          </span>
        </div>
        <div className="w-full h-3 bg-white/70 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            className={`h-full ${state.is_completed ? 'bg-green-500' : 'bg-[#fb7701]'}`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs font-bold text-gray-600 mb-6">
        <span>Today: {state.actions_today} / {state.actions_daily_cap}</span>
        {dailyCapReached && !state.is_completed && (
          <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Come back tomorrow</span>
        )}
      </div>

      {state.is_completed ? (
        <button
          onClick={handleReset}
          disabled={busy}
          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-black transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} /> Start a new round
        </button>
      ) : (
        <button
          onClick={handleAction}
          disabled={disabled}
          className={`w-full ${meta.button} text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {busy ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {meta.actionLabel}
        </button>
      )}

      {state.is_completed && (
        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-green-700 justify-center">
          <Trophy size={14} /> Round complete — reward added to My Rewards
        </div>
      )}

      <SkillChallengeModal
        open={challengeOpen}
        gameType={state.game_type}
        level={state.level}
        onClose={() => setChallengeOpen(false)}
        onSuccess={handleChallengeSuccess}
      />
    </div>
  );
};

const MiniGamesPage = () => {
  const { setUser } = useAuthStore();
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await gamificationService.listGames();
        if (!cancelled) setStates(list);
      } catch {
        if (!cancelled) toast.error('Could not load mini-games');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleActionComplete = async (res) => {
    setStates((prev) =>
      prev.map((s) => (s.game_type === res.state.game_type ? res.state : s)),
    );
    if (res?.completed_just_now) {
      try {
        const me = await api.get('/user/me');
        setUser(me.data);
      } catch { /* non-blocking */ }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-gray-900 flex items-center justify-center gap-3">
          Mini Games <Gamepad2 className="text-[#fb7701]" size={40} />
        </h1>
        <p className="text-gray-500 font-medium mt-2">Tap daily. Grow your fish and your plant. Win real rewards.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {states.map((s) => (
          <GameCard
            key={s.game_type}
            state={s}
            onActionComplete={handleActionComplete}
          />
        ))}
      </div>

      <div className="mt-12 bg-orange-50 border-2 border-dashed border-orange-200 rounded-3xl p-6 flex items-start gap-4">
        <div className="p-3 bg-orange-100 rounded-2xl text-[#fb7701]">
          <Gift size={24} />
        </div>
        <div className="text-sm text-gray-700">
          <p className="font-black uppercase tracking-widest text-xs text-[#fb7701] mb-1">How it works</p>
          <p>Tap the action button to start a quick skill challenge — <strong>catch the fish</strong> in Fishland, <strong>pick the ripe plant</strong> in Farmland. Only a successful round earns +1 point. Hit 10 points to level up, max level (5) to claim a reward. Up to <strong>5 attempts per day</strong> per game, and difficulty rises every level — pace yourself!</p>
        </div>
      </div>
    </div>
  );
};

export default MiniGamesPage;
