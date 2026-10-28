'use client';

import React, { Suspense } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-canvas flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand-primary/20 border-t-brand-primary animate-spin" />
        </div>
      }
    >
      <AuthForm initialMode="login" isStandalone />
    </Suspense>
  );
}
