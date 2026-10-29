import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  href?: string;
  iconOnly?: boolean;
  theme?: 'auto' | 'light' | 'dark';
}

export function Logo({
  size = 'md',
  showTagline = false,
  className = '',
  href = '/',
  iconOnly = false,
  theme = 'auto',
}: LogoProps) {
  const pixelSizes = {
    sm: 30,
    md: 38,
    lg: 46,
    xl: 56,
  };

  const iconClasses = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-11 h-11 sm:w-12 sm:h-12',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-xl',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  };

  const isLight = theme === 'light';

  const content = (
    <div className={`flex items-center gap-2.5 sm:gap-3 group select-none ${className}`}>
      {/* 3D Moon Flashcard Logo Icon */}
      <div
        className={`${iconClasses[size]} relative flex-shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-0.5 filter drop-shadow-sm`}
      >
        <Image
          src="/brand/logo-icon.svg"
          alt="Vocelune Moon Flashcard"
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          className="w-full h-full object-contain"
          priority
          unoptimized
        />
      </div>

      {/* Brand Name & Tagline */}
      {!iconOnly && (
        <div className="flex flex-col">
          <span
            className={`font-extrabold tracking-tight leading-none transition-colors ${
              isLight ? 'text-white' : 'text-brand-ink group-hover:text-brand-primary'
            } ${textSizes[size]}`}
          >
            Vocelune
          </span>
          {showTagline && (
            <span
              className={`text-[11px] mt-0.5 font-normal tracking-wide transition-colors ${
                isLight ? 'text-slate-300' : 'text-text-secondary'
              }`}
            >
              Mỗi từ, một nhịp nhớ.
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
