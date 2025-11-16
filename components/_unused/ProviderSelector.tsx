'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, DollarSign, Sparkles, ChevronDown, Info } from 'lucide-react';

interface ProviderSelectorProps {
  onProviderChange?: (provider: 'auto' | 'inworld' | 'openai') => void;
  textLength?: number;
}

export function ProviderSelector({ onProviderChange, textLength = 0 }: ProviderSelectorProps) {
  const [selectedProvider, setSelectedProvider] = useState<'auto' | 'inworld' | 'openai'>('auto');
  const [showDetails, setShowDetails] = useState(false);

  // Calculate costs based on text length
  const costs = {
    openai: (textLength / 1000) * 0.030,
    inworld: (textLength / 1_000_000) * 10,
    savings: ((textLength / 1000) * 0.030) - ((textLength / 1_000_000) * 10)
  };

  const savingsPercent = costs.openai > 0 ? (costs.savings / costs.openai * 100) : 67;

  const handleProviderChange = (provider: 'auto' | 'inworld' | 'openai') => {
    setSelectedProvider(provider);
    onProviderChange?.(provider);
  };

  const providers = [
    {
      id: 'auto',
      name: 'Auto (Lowest Cost)',
      description: 'Automatically selects the cheapest available provider',
      icon: Zap,
      color: 'from-purple-500 to-pink-500',
      badge: 'Recommended',
      badgeColor: 'bg-gradient-to-r from-purple-500 to-pink-500'
    },
    {
      id: 'inworld',
      name: 'Inworld AI',
      description: '$10 per 1M characters • 67% cheaper',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500',
      badge: 'Best Value',
      badgeColor: 'bg-gradient-to-r from-green-500 to-emerald-500'
    },
    {
      id: 'openai',
      name: 'OpenAI HD',
      description: '$30 per 1M characters • Premium quality',
      icon: Sparkles,
      color: 'from-blue-500 to-cyan-500',
      badge: 'Highest Quality',
      badgeColor: 'bg-gradient-to-r from-blue-500 to-cyan-500'
    }
  ];

  return (
    <div className="w-full">
      {/* Provider Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {providers.map((provider) => {
          const Icon = provider.icon;
          const isSelected = selectedProvider === provider.id;

          return (
            <motion.button
              key={provider.id}
              onClick={() => handleProviderChange(provider.id as any)}
              className={`
                relative p-4 rounded-xl text-left transition-all
                ${isSelected
                  ? 'glass-card-active border-2 border-purple-500/30'
                  : 'glass-card hover:scale-[1.02]'
                }
              `}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Badge */}
              {provider.badge && (
                <motion.div
                  className={`absolute -top-2 -right-2 px-2 py-1 rounded-full text-white text-xs font-semibold ${provider.badgeColor}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  {provider.badge}
                </motion.div>
              )}

              {/* Icon */}
              <div className={`inline-flex p-2 rounded-lg bg-gradient-to-r ${provider.color} mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {provider.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {provider.description}
              </p>

              {/* Selection Indicator */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${provider.color} opacity-10`} />
                    <div className={`absolute inset-0 rounded-xl border-2 border-gradient-to-r ${provider.color}`} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>

      {/* Cost Comparison (if text length provided) */}
      <AnimatePresence>
        {textLength > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-4 mb-4"
          >
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-medium text-sm">Cost Comparison</span>
              </div>
              <motion.div
                animate={{ rotate: showDetails ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </motion.div>
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 space-y-3"
                >
                  {/* OpenAI Cost */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      OpenAI HD ({textLength.toLocaleString()} chars)
                    </span>
                    <span className="font-mono text-sm">
                      ${costs.openai.toFixed(4)}
                    </span>
                  </div>

                  {/* Inworld Cost */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Inworld AI ({textLength.toLocaleString()} chars)
                    </span>
                    <span className="font-mono text-sm text-green-600 dark:text-green-400">
                      ${costs.inworld.toFixed(4)}
                    </span>
                  </div>

                  {/* Savings */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Potential Savings</span>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-green-600 dark:text-green-400">
                          ${costs.savings.toFixed(4)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {savingsPercent.toFixed(0)}% cheaper
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Note */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Inworld AI uses advanced neural voices optimized for long-form content.
                      Quality is comparable to OpenAI for most use cases.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A/B Testing Notice */}
      {process.env.NEXT_PUBLIC_AB_TESTING_ENABLED === 'true' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 glass-card border border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-950/20"
        >
          <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            A/B testing is active. We're comparing providers to ensure optimal quality.
          </p>
        </motion.div>
      )}
    </div>
  );
}