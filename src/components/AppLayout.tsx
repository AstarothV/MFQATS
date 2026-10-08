'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Topbar from './Topbar';
import Sidebar from './ui/Sidebar';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
  role: 'staff' | 'admin' | 'customer';
  currentPath?: string;
}

// Set by the persistent shell (rendered from each role's route-group layout.tsx).
// Pages still wrap themselves in <AppLayout>; inside a shell that wrapper only reports
// its currentPath, so the sidebar/topbar stay mounted across navigation.
const ShellContext = createContext<((path: string | undefined) => void) | null>(null);

export default function AppLayout(props: AppLayoutProps) {
  const setPagePath = useContext(ShellContext);
  if (setPagePath) return <NestedPage setPagePath={setPagePath} {...props} />;
  return <Shell {...props} />;
}

function NestedPage({
  children,
  currentPath,
  setPagePath,
}: AppLayoutProps & { setPagePath: (p: string | undefined) => void }) {
  useEffect(() => {
    setPagePath(currentPath);
    return () => setPagePath(undefined);
  }, [currentPath, setPagePath]);
  return <>{children}</>;
}

function Shell({ children, role, currentPath }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [pagePath, setPagePath] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar.collapsed') === 'true');
    } catch {
      // storage unavailable (private mode): default to expanded
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar.collapsed', !c ? 'true' : 'false');
      } catch {
        // storage unavailable: the preference just isn't persisted
      }
      return !c;
    });
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/sign-up-login-screen');
    }
  }, [user, loading, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ShellContext.Provider value={setPagePath}>
      <div
        className="min-h-screen bg-background text-foreground pt-16 overflow-x-hidden"
        style={{ '--sidebar-width': collapsed ? '5rem' : '18rem' } as React.CSSProperties}
      >
        <Topbar role={role} onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        <div className="flex">
          <Sidebar
            role={role}
            currentPath={pagePath || currentPath || pathname}
            open={sidebarOpen}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="flex-1 min-w-0 min-h-[calc(100vh-4rem)] py-6 px-4 sm:px-5 lg:px-8 xl:px-10 2xl:px-16 transition-[margin] duration-200 motion-reduce:transition-none lg:ml-[var(--sidebar-width)]">
            {children}
          </main>
        </div>
      </div>
    </ShellContext.Provider>
  );
}
