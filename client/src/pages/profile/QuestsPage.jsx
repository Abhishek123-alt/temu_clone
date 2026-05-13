import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Target, CheckCircle2, Circle } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const QuestsPage = () => {
  const { user, setUser } = useAuthStore();
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuests = async () => {
      try {
        const res = await api.get('/quests/my-progress');
        setQuests(res.data);
      } catch (error) {
        console.error('Failed to fetch quests:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuests();

    // Set up real-time polling (every 5 seconds)
    const interval = setInterval(() => {
      fetchQuests();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-[#fb7701] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gray-900 flex items-center justify-center gap-3">
          My Quests <Trophy className="text-[#fb7701]" size={40} />
        </h1>
        <p className="text-gray-500 font-medium mt-2">Complete challenges and earn amazing rewards!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quests.length > 0 ? (
          quests.map((quest) => (
            <motion.div
              key={quest.quest_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white p-6 rounded-[32px] shadow-sm border-2 transition-all ${
                quest.is_completed ? 'border-green-500 bg-green-50/30' : 'border-gray-100 hover:border-[#fb7701]/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-2xl text-[#fb7701]">
                  {quest.is_completed ? <CheckCircle2 size={24} /> : <Target size={24} />}
                </div>
                <div className="text-right">
                  <span className="text-xs font-black uppercase tracking-tighter text-gray-400">Reward</span>
                  <p className="text-lg font-bold text-gray-900">{quest.reward_value}</p>
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-1">{quest.title}</h3>
              <p className="text-gray-500 text-sm mb-6">{quest.description}</p>

              <div className="space-y-2">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase">Progress</span>
                  <span className="text-sm font-black text-gray-900">
                    {quest.current_progress} / {quest.requirement_value}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((quest.current_progress / quest.requirement_value) * 100, 100)}%` }}
                    className={`h-full ${quest.is_completed ? 'bg-green-500' : 'bg-[#fb7701]'}`}
                  />
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-20">
            <p className="text-xl font-bold text-gray-400">No active quests found. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestsPage;
