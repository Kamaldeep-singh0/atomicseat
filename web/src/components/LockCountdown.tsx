'use client';

import React, { useState, useEffect } from 'react';
import { Timer } from 'lucide-react';

interface Props {
  lockedUntil: string | Date;
  onExpired?: () => void;
  className?: string;
}

export function LockCountdown({ lockedUntil, onExpired, className = '' }: Props) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  useEffect(() => {
    const target = new Date(lockedUntil).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((target - now) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0 && onExpired) {
        onExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [lockedUntil, onExpired]);

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const isUrgent = secondsRemaining < 60;

  return (
    <div
      className={`inline-flex items-center space-x-1.5 font-mono text-sm px-2.5 py-1 rounded-md border ${
        isUrgent
          ? 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
          : 'bg-brand/10 text-brand border-brand/30'
      } ${className}`}
    >
      <Timer className="w-4 h-4" />
      <span>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
