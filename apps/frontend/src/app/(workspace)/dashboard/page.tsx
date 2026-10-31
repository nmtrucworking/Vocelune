'use client';

import React, { useState } from 'react';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { QuickAddModal } from '@/components/library/QuickAddModal';
import { AdminView } from '@/components/admin/AdminView';
import { useVocelune } from '@/context/VoceluneContext';

export default function DashboardPage() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const { user } = useVocelune();

  if (user?.role === 'admin') {
    return (
      <div className="py-2">
        <AdminView />
      </div>
    );
  }

  return (
    <>
      <DashboardView onOpenQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </>
  );
}
