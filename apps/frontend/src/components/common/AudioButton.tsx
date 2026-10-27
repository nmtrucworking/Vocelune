'use client';

import React, { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { speakWord } from '@/lib/speech';
import { Dialect } from '@/types';

interface AudioButtonProps {
  text: string;
  dialect?: Dialect;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function AudioButton({
  text,
  dialect = 'en-us',
  size = 'md',
  showLabel = false,
  className = '',
}: AudioButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(true);

    speakWord(text, dialect, {
      onStart: () => setIsPlaying(true),
      onEnd: () => setIsPlaying(false),
      onError: () => setIsPlaying(false),
    });

    // Safety timeout in case audio finish event is missed
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <button
      type="button"
      onClick={handlePlay}
      className={`rounded-control transition-all duration-150 flex items-center gap-1.5 font-medium ${
        isPlaying
          ? 'bg-brand-primary text-white shadow-md scale-105'
          : 'bg-brand-primarySoft text-brand-primary hover:bg-brand-primary hover:text-white'
      } ${sizeClasses[size]} ${className}`}
      title={`Nghe phát âm (${dialect.toUpperCase()})`}
    >
      {isPlaying ? (
        /* Equalizer Animation Bars */
        <span className="flex items-center gap-0.5 h-4 px-0.5">
          <span className="w-0.5 h-3 bg-current rounded-full animate-pulse" />
          <span className="w-0.5 h-4 bg-current rounded-full animate-bounce" />
          <span className="w-0.5 h-2 bg-current rounded-full animate-pulse" />
        </span>
      ) : (
        <Volume2 className={iconSizes[size]} />
      )}

      {showLabel && (
        <span className="text-[11px] font-semibold uppercase">
          {isPlaying ? 'Đang phát...' : dialect}
        </span>
      )}
    </button>
  );
}
