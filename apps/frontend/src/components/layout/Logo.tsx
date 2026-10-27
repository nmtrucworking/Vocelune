import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showTagline = false, className = '' }: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <Link href="/app/dashboard" className={`flex items-center gap-2.5 group select-none ${className}`}>
      {/* Recall Orbit SVG Icon with Floating/Pulse Animation */}
      <div
        className={`${iconSizes[size]} relative flex items-center justify-center rounded-control bg-brand-primary text-white shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-elevated animate-float-orbit`}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5/6 h-5/6"
        >
          {/* Subtle Orbit Track */}
          <ellipse
            cx="16"
            cy="16"
            rx="11"
            ry="6"
            transform="rotate(-25 16 16)"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="2 3"
            strokeOpacity="0.75"
          />
          {/* Center Memory Card */}
          <rect
            x="11"
            y="9"
            width="10"
            height="14"
            rx="2.5"
            fill="white"
            fillOpacity="0.95"
            className="transition-transform duration-200 group-hover:scale-105"
          />
          {/* Subtle V negative cut */}
          <path
            d="M13 12L16 17L19 12"
            stroke="#5949E8"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Memory nodes on orbit with subtle glowing pulse */}
          <circle cx="6.5" cy="11.5" r="1.6" fill="#D8F7F1" className="animate-pulse" />
          <circle cx="25.5" cy="20.5" r="1.6" fill="#D8F7F1" className="animate-pulse" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={`font-extrabold tracking-tight text-brand-ink leading-none ${textSizes[size]}`}
        >
          Vocelune
        </span>
        {showTagline && (
          <span className="text-[11px] text-text-secondary mt-0.5 font-normal tracking-wide">
            Mỗi từ, một nhịp nhớ.
          </span>
        )}
      </div>
    </Link>
  );
}
