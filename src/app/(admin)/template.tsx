import React from 'react';

// Re-mounted on every navigation (unlike layout.tsx): gives the incoming page a short fade.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
