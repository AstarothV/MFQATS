'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import StaffARVisualizationContent from './components/StaffARVisualizationContent';

export default function StaffARVisualizationPage() {
  return (
    <AppLayout role="staff" currentPath="/staff/ar-visualization">
      <StaffARVisualizationContent />
    </AppLayout>
  );
}
