'use client';

import React, { useState, useEffect } from 'react';
import { AuthForm } from '../auth/AuthForm';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { QuickAddModal } from '../library/QuickAddModal';
import { useVocelune } from '@/context/VoceluneContext';
import { isWorkspaceHost, getWorkspaceUrl } from '@/lib/urls';

interface AppShellProps {
  children: React.ReactNode;
  pageTitle?: string;
}

export function AppShell({ children, pageTitle }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { isLoaded, user, error, clearError, refresh } = useVocelune();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const { hostname, pathname, search } = window.location;
      if (!isWorkspaceHost(hostname) && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        const target = getWorkspaceUrl(pathname + search);
        if (target !== pathname + search) {
          window.location.replace(target);
        }
      }
    }
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-brand-primary/20 border-t-brand-primary animate-spin mb-3" />
        <p className="text-xs font-semibold text-text-secondary tracking-wide uppercase">
          Khởi động Vocelune...
        </p>
      </div>
    );
  }

  if (!user) return <><AuthForm />{error && <div role="alert" className="fixed bottom-4 inset-x-4 bg-rose-50 border border-rose-200 p-4 rounded-lg text-sm text-rose-700">{error}<button className="ml-4 underline" onClick={() => void refresh().then(clearError).catch(() => {})}>Thử kết nối lại</button></div>}</>;

  return (
    <div className="min-h-screen bg-brand-canvas flex flex-col md:flex-row text-brand-ink antialiased">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile Slide-over Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full bg-surface-base shadow-xl z-50">
            <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenQuickAdd={() => setQuickAddOpen(true)}
          pageTitle={pageTitle}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {error && <div role="alert" className="mb-4 flex justify-between bg-rose-50 text-rose-700 border border-rose-200 rounded-lg p-3 text-sm">{error}<button onClick={clearError} aria-label="Đóng thông báo">×</button></div>}
          {children}
        </main>
      </div>

      {/* Global Quick Add Modal */}
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </div>
  );
}
