'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Star, 
  Award, 
  TrendingUp, 
  Users, 
  Target,
  Zap,
  Crown,
  Medal,
  Gift,
  Fire,
  Calendar,
  BarChart3
} from 'lucide-react';
import { 
  gamificationService, 
  UserStats, 
  UserLevel, 
  Achievement, 
  LeaderboardEntry,
  LEVELS 
} from '@/app/lib/gamification';
import { useAuth } from '@/app/contexts/AuthContext';
import { useNotifications, createAchievementNotification } from '@/app/contexts/NotificationContext';

export default function GamificationDashboard() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [currentLevel, setCurrentLevel] = useState<UserLevel | null>(null);
  const [nextLevel, setNextLevel] = useState<UserLevel | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'leaderboard'>('overview');

  useEffect(() => {
    if (user) {
      loadUserStats();
      setLeaderboard(gamificationService.getLeaderboard());
    }
  }, [user]);

  const loadUserStats = () => {
    if (!user) return;
    
    const stats = gamificationService.getUserStats(user.id);
    setUserStats(stats);
    setCurrentLevel(gamificationService.getCurrentLevel(user.id));
    setNextLevel(gamificationService.getNextLevel(user.id));
  };

  const getAchievementCategoryColor = (category: string) => {
    switch (category) {
      case 'donation': return 'bg-blue-100 text-blue-800';
      case 'volunteer': return 'bg-green-100 text-green-800';
      case 'social': return 'bg-purple-100 text-purple-800';
      case 'milestone': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAchievementCategoryIcon = (category: string) => {
    switch (category) {
      case 'donation': return '🎁';
      case 'volunteer': return '🚚';
      case 'social': return '🤝';
      case 'milestone': return '🏆';
      default: return '⭐';
    }
  };

  const unlockedAchievements = userStats?.achievements.filter(a => a.unlocked) || [];
  const lockedAchievements = userStats?.achievements.filter(a => !a.unlocked) || [];

  if (!userStats) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Level Progress Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 text-white"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Level {userStats.currentLevel}</h2>
            <p className="text-purple-100">{currentLevel?.title}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{userStats.totalPoints}</div>
            <div className="text-purple-100">Total Points</div>
          </div>
        </div>

        {/* Level Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Progress to Level {userStats.currentLevel + 1}</span>
            <span>{Math.round(userStats.levelProgress)}%</span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${userStats.levelProgress}%` }}
              transition={{ duration: 1, delay: 0.5 }}
              className="bg-white h-3 rounded-full"
            />
          </div>
        </div>

        {/* Next Level Info */}
        {nextLevel && (
          <div className="bg-white/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Next: Level {nextLevel.level} - {nextLevel.title}</p>
                <p className="text-xs text-purple-100">
                  {nextLevel.pointsRequired - userStats.totalPoints} points needed
                </p>
              </div>
              <div className="text-2xl">{nextLevel.icon}</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
          Your Stats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{userStats.totalDonations}</div>
            <div className="text-sm text-gray-600">Donations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{userStats.totalDeliveries}</div>
            <div className="text-sm text-gray-600">Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{userStats.streak}</div>
            <div className="text-sm text-gray-600">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{unlockedAchievements.length}</div>
            <div className="text-sm text-gray-600">Achievements</div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: Target },
              { id: 'achievements', label: 'Achievements', icon: Trophy },
              { id: 'leaderboard', label: 'Leaderboard', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Recent Achievements */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Recent Achievements</h4>
                {unlockedAchievements.slice(0, 3).length > 0 ? (
                  <div className="space-y-3">
                    {unlockedAchievements.slice(0, 3).map((achievement) => (
                      <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{achievement.name}</div>
                          <div className="text-sm text-gray-600">{achievement.description}</div>
                        </div>
                        <div className="text-sm font-bold text-green-600">+{achievement.points}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No achievements unlocked yet. Start donating to earn achievements!</p>
                )}
              </div>

              {/* Rewards */}
              {currentLevel && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Current Rewards</h4>
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="text-2xl">{currentLevel.icon}</div>
                      <div>
                        <div className="font-semibold text-gray-900">{currentLevel.title}</div>
                        <div className="text-sm text-gray-600">Level {currentLevel.level}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {currentLevel.rewards.map((reward, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm">
                          <Gift className="w-4 h-4 text-yellow-600" />
                          <span className="text-gray-700">{reward}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Achievements Tab */}
          {activeTab === 'achievements' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Achievement Categories */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Unlocked Achievements */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                    Unlocked ({unlockedAchievements.length})
                  </h4>
                  <div className="space-y-3">
                    {unlockedAchievements.map((achievement) => (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
                      >
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{achievement.name}</div>
                          <div className="text-sm text-gray-600">{achievement.description}</div>
                          {achievement.unlockedAt && (
                            <div className="text-xs text-gray-500">
                              Unlocked {achievement.unlockedAt.toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-green-600">+{achievement.points}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Locked Achievements */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-gray-600" />
                    Locked ({lockedAchievements.length})
                  </h4>
                  <div className="space-y-3">
                    {lockedAchievements.map((achievement) => (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200 opacity-60"
                      >
                        <div className="text-2xl grayscale">{achievement.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-500">{achievement.name}</div>
                          <div className="text-sm text-gray-400">{achievement.description}</div>
                          <div className="text-xs text-gray-400">
                            Requires: {achievement.requirement.value} {achievement.requirement.type}
                          </div>
                        </div>
                        <div className="text-sm font-bold text-gray-400">+{achievement.points}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Crown className="w-5 h-5 mr-2 text-yellow-600" />
                Community Leaderboard
              </h4>
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`flex items-center space-x-4 p-4 rounded-lg border ${
                      index === 0 ? 'bg-yellow-50 border-yellow-200' :
                      index === 1 ? 'bg-gray-50 border-gray-200' :
                      index === 2 ? 'bg-orange-50 border-orange-200' :
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 font-bold text-sm">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : entry.rank}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{entry.userName}</div>
                      <div className="text-sm text-gray-600">
                        Level {entry.level} • {entry.achievements} achievements
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">{entry.points}</div>
                      <div className="text-sm text-gray-600">points</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
} 