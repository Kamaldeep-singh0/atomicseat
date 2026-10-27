'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type LockingStrategy = 'naive' | 'mongo-atomic' | 'redis-lock';

interface StrategyContextType {
  strategy: LockingStrategy;
  setStrategy: (strategy: LockingStrategy) => void;
}

const StrategyContext = createContext<StrategyContextType | undefined>(undefined);

export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [strategy, setStrategyState] = useState<LockingStrategy>('mongo-atomic');

  useEffect(() => {
    const saved = localStorage.getItem('atomic_seat_strategy') as LockingStrategy;
    if (saved && ['naive', 'mongo-atomic', 'redis-lock'].includes(saved)) {
      setStrategyState(saved);
    }
  }, []);

  const setStrategy = (newStrategy: LockingStrategy) => {
    setStrategyState(newStrategy);
    localStorage.setItem('atomic_seat_strategy', newStrategy);
  };

  return (
    <StrategyContext.Provider value={{ strategy, setStrategy }}>
      {children}
    </StrategyContext.Provider>
  );
}

export function useStrategy() {
  const context = useContext(StrategyContext);
  if (!context) {
    throw new Error('useStrategy must be used within a StrategyProvider');
  }
  return context;
}
