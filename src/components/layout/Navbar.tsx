'use client';

import React from 'react';
import { Menu, Plus, Volume2, Search, Bell } from 'lucide-react';
import { useVocelune } from '@/context/VoceluneContext';
import { speakWord } from '@/lib/speech';

interface NavbarProps {
  onOpenMobileSidebar: () => void;
  onOpenQuickAdd: () => void;
  pageTitle?: string;
}

export function Navbar({ onOpenMobileSidebar, onOpenQuickAdd, pageTitle }: NavbarProps) {
  const { settings } = useVocelune();

  const handleTestAudio = () => {
    speakWord('Vocelune, a rhythm for every word.', settings.englishDialect);
  };

  return (
    <header className="h-16 bg-surface-base border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 rounded-lg text-text-secondary hover:bg-slate-100 md:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {pageTitle && (
          <h1 className="text-base font-semibold text-brand-ink hidden sm:block">
            {pageTitle}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Audio Dialect Quick Tester */}
        <button
          onClick={handleTestAudio}
          title={`Phát âm mẫu (${settings.englishDialect.toUpperCase()})`}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-brand-primary bg-slate-100 hover:bg-brand-primarySoft rounded-control transition-colors"
        >
          <Volume2 className="w-3.5 h-3.5 text-brand-primary" />
          <span className="uppercase">{settings.englishDialect}</span>
        </button>

        {/* Quick Add Button */}
        <button
          onClick={onOpenQuickAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primaryHover rounded-control shadow-sm transition-all duration-150 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Thêm từ</span>
        </button>

        {/* Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-brand-primarySoft text-brand-primary flex items-center justify-center font-bold text-xs border border-brand-primary/20">
            {settings.displayName.charAt(0)}
          </div>
          <span className="text-xs font-medium text-brand-ink hidden lg:inline">
            {settings.displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
