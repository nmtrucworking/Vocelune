'use client';

import React, { useState } from 'react';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { QuickAddModal } from '@/components/library/QuickAddModal';

export default function DashboardPage() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

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
