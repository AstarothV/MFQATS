'use client';
import React from 'react';
import dynamic from 'next/dynamic';

const SparklineChart = dynamic(() => import('./SparklineChart'), { ssr: false });

interface KPISparklineCardProps {
  id: string;
  label: string;
  value: string;
  unit: string;
  delta: string;
  deltaPositive: boolean;
  variant: 'neutral' | 'warning' | 'danger' | 'ok';
  sparkData: number[];
  sparkColor: string;
}

const variantBorder: Record<string, string> = {
  neutral: 'border-border',
  warning: 'border-warning/30',
  danger: 'border-danger/30',
  ok: 'border-success/30',
};

const variantBg: Record<string, string> = {
  neutral: '',
  warning: 'bg-warning/5',
  danger: 'bg-danger/5',
  ok: 'bg-success/5',
};

export default function KPISparklineCard({
  label, value, unit, delta, deltaPositive, variant, sparkData, sparkColor,
}: KPISparklineCardProps) {
  return (
    <div className={`card-dark p-5 border ${variantBorder[variant]} ${variantBg[variant]} flex flex-col justify-between min-h-[130px]`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-snug max-w-[120px]">
          {label}
        </p>
        <div className="w-20 h-10 shrink-0">
          <SparklineChart data={sparkData} color={sparkColor} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground tabular-nums leading-none mt-2">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{unit}</p>
        <p className={`text-xs mt-1.5 font-medium ${deltaPositive ? 'text-success' : variant === 'neutral' ? 'text-muted-foreground' : 'text-warning'}`}>
          {delta}
        </p>
      </div>
    </div>
  );
}