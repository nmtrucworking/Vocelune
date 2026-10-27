'use client';

import React, { useState } from 'react';
import { LibraryView } from '@/components/library/LibraryView';
import { QuickAddModal } from '@/components/library/QuickAddModal';

export default function LibraryPage() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <>
      <LibraryView onOpenQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />
    </>
  );
}
