import React from 'react';

type StatusVariant = 'ok' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface StatusBadgeProps {
  variant: StatusVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const variantClass: Record<StatusVariant, string> = {
  ok: 'status-ok',
  warning: 'status-warning',
  danger: 'status-danger',
  info: 'status-info',
  neutral: 'status-neutral',
  purple: 'bg-primary/20 text-accent border border-primary/30',
};

const dotColor: Record<StatusVariant, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-accent',
  neutral: 'bg-muted-foreground',
  purple: 'bg-primary',
};

export default function StatusBadge({ variant, label, dot = false, className = '' }: StatusBadgeProps) {
  return (
    <span className={`badge ${variantClass[variant]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor[variant]}`} />}
      {label}
    </span>
  );
}