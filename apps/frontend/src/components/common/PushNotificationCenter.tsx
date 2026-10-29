'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Bell, X, Volume2, VolumeX } from 'lucide-react';
import { useNotification, PushNotificationItem } from '@/context/NotificationContext';

export function PushNotificationCenter() {
  const { notifications, dismiss } = useNotification();

  return (
    <div
      aria-live="polite"
      aria-label="Thông báo hệ thống"
      className="fixed top-4 right-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] flex flex-col gap-2.5 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {notifications.map((item) => (
          <NotificationToast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationToast({
  item,
  onDismiss,
}: {
  item: PushNotificationItem;
  onDismiss: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!item.duration || isHovered) return;
    const intervalTime = 50;
    const step = (intervalTime / item.duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return Math.max(0, prev - step);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [item.duration, isHovered]);

  const config = {
    success: {
      border: 'border-emerald-200/90',
      badgeBg: 'bg-emerald-100 text-emerald-700',
      progressBar: 'bg-emerald-500',
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    },
    error: {
      border: 'border-rose-200/90',
      badgeBg: 'bg-rose-100 text-rose-700',
      progressBar: 'bg-rose-500',
      icon: <AlertCircle className="w-5 h-5 shrink-0" />,
    },
    warning: {
      border: 'border-amber-200/90',
      badgeBg: 'bg-amber-100 text-amber-800',
      progressBar: 'bg-amber-500',
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
    },
    info: {
      border: 'border-indigo-200/90',
      badgeBg: 'bg-indigo-100 text-indigo-700',
      progressBar: 'bg-brand-primary',
      icon: <Bell className="w-5 h-5 shrink-0" />,
    },
  }[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto relative overflow-hidden rounded-card bg-white/95 backdrop-blur-md shadow-elevated border ${config.border} p-3.5 flex items-start gap-3 transition-colors`}
    >
      {/* Icon Badge */}
      <div className={`p-1.5 rounded-control ${config.badgeBg} flex items-center justify-center shrink-0`}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-sm font-semibold text-brand-ink leading-tight">{item.title}</h4>
        {item.message && (
          <p className="text-xs text-text-secondary mt-1 leading-relaxed break-words">
            {item.message}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onDismiss}
        aria-label="Đóng thông báo"
        className="p-1 rounded-md text-slate-400 hover:text-brand-ink hover:bg-slate-100/80 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress countdown bar */}
      {item.duration && (
        <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${config.progressBar} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}
