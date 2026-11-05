import React from 'react';
import AppLayout from '@/components/AppLayout';
import ProfileSettings from '@/components/ProfileSettings';

export default function ProfilePage() {
  return (
    <AppLayout role="customer" currentPath="/customer-dashboard/profile">
      <ProfileSettings />
    </AppLayout>
  );
}
