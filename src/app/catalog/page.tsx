'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import CatalogContent from './components/CatalogContent';

export default function CatalogPage() {
  return (
    <AppLayout role="admin" currentPath="/catalog">
      <CatalogContent />
    </AppLayout>
  );
}
