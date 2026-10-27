import React from 'react';
import { redirect } from 'next/navigation';
import LandingPage from './landing/page';

// If Supabase sends a reset link to the Site URL (the home page) instead of /auth/reset, the one-time code arrives
// here; pass it on so the reset still works.
export default async function RootPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code) redirect(`/auth/reset?code=${encodeURIComponent(code)}`);
  return <LandingPage />;
}
