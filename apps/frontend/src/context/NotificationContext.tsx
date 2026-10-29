'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  playNotificationSound,
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
  NotificationSoundType,
} from '@/lib/notification-sound';

export interface PushNotificationItem {
  id: string;
  type: NotificationSoundType;
  title: string;
  message?: string;
  duration?: number;
  createdAt: number;
}

export interface NotificationOptions {
  message?: string;
  duration?: number;
  sound?: boolean;
  browserPush?: boolean;
}

interface NotificationContextType {
  notifications: PushNotificationItem[];
  notify: {
    (type: NotificationSoundType, title: string, options?: NotificationOptions): string;
    success: (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => string;
    error: (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => string;
    warning: (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => string;
    info: (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => string;
  };
  dismiss: (id: string) => void;
  clearAll: () => void;
  soundEnabled: boolean;
  toggleSound: () => boolean;
  browserPushSupported: boolean;
  browserPushPermission: NotificationPermission | 'unsupported';
  requestBrowserPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [soundEnabled, setSoundEnabledState] = useState(true);
  const [browserPushPermission, setBrowserPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [browserPushSupported, setBrowserPushSupported] = useState(false);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    setSoundEnabledState(isNotificationSoundEnabled());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserPushSupported(true);
      setBrowserPushPermission(Notification.permission);
    } else {
      setBrowserPushPermission('unsupported');
    }
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabledState(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playNotificationSound('success');
    }
    return next;
  }, [soundEnabled]);

  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    try {
      const res = await Notification.requestPermission();
      setBrowserPushPermission(res);
      if (res === 'granted') {
        playNotificationSound('info');
        try {
          new Notification('Vocelune — Đã bật thông báo đẩy', {
            body: 'Bạn sẽ nhận thông báo khi hoàn thành tác vụ và đến lịch ôn tập.',
            icon: '/icon.png',
          });
        } catch {
          // Ignore
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setNotifications([]);
  }, []);

  const addNotification = useCallback(
    (type: NotificationSoundType, title: string, options?: NotificationOptions): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = options?.duration ?? (type === 'error' ? 6000 : type === 'warning' ? 5000 : 4200);

      // 1. Audio sound feedback
      if (options?.sound !== false && soundEnabled) {
        playNotificationSound(type);
      }

      // 2. Native Browser Push Notification
      if (
        options?.browserPush !== false &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(title, {
            body: options?.message,
            icon: '/icon.png',
            tag: id,
          });
        } catch {
          // Ignore
        }
      }

      // 3. In-App Floating Push Toast
      const item: PushNotificationItem = {
        id,
        type,
        title,
        message: options?.message,
        duration,
        createdAt: Date.now(),
      };

      setNotifications((prev) => [item, ...prev.slice(0, 5)]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [soundEnabled, dismiss]
  );

  const notifyFn = useCallback(
    (type: NotificationSoundType, title: string, options?: NotificationOptions) => {
      return addNotification(type, title, options);
    },
    [addNotification]
  ) as NotificationContextType['notify'];

  notifyFn.success = useCallback(
    (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => {
      return addNotification('success', title, { ...options, message });
    },
    [addNotification]
  );

  notifyFn.error = useCallback(
    (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => {
      return addNotification('error', title, { ...options, message });
    },
    [addNotification]
  );

  notifyFn.warning = useCallback(
    (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => {
      return addNotification('warning', title, { ...options, message });
    },
    [addNotification]
  );

  notifyFn.info = useCallback(
    (title: string, message?: string, options?: Omit<NotificationOptions, 'message'>) => {
      return addNotification('info', title, { ...options, message });
    },
    [addNotification]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify: notifyFn,
        dismiss,
        clearAll,
        soundEnabled,
        toggleSound,
        browserPushSupported,
        browserPushPermission,
        requestBrowserPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
