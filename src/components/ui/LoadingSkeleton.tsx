import React from 'react';

// Skeleton building blocks. Colors come from theme tokens (see .skeleton in tailwind.css), so they
// work in light and dark mode. Blocks are "bare": wrap a loading area in <SkeletonRegion> once,
// which announces it to screen readers and delays the fade-in so fast loads don't flash.

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

export function SkeletonRegion({
  children,
  className = '',
  label = 'Loading',
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`skeleton-reveal ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- blocks ---------- */

export function PageHeaderSkeleton({
  eyebrow = true,
  actions = 0,
}: {
  eyebrow?: boolean;
  actions?: number;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow && <Skeleton className="h-3 w-32" />}
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-3">
          {range(actions).map((i) => (
            <Skeleton key={i} className="h-10 w-36 rounded-lg" />
          ))}
        </div>
      )}
    </div>
  );
}

export function FilterBarSkeleton({
  search = false,
  chips = 0,
}: {
  search?: boolean;
  chips?: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {search && <Skeleton className="h-10 w-full rounded-lg sm:min-w-[12rem] sm:flex-1" />}
      {chips > 0 && (
        <div className="flex flex-wrap gap-2">
          {range(chips).map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="card-dark rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}

export function StatCardsSkeleton({
  count = 4,
  compact = false,
  className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4',
}: {
  count?: number;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {range(count).map((i) =>
        compact ? (
          <div key={i} className="card-dark rounded-3xl p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ) : (
          <KPICardSkeleton key={i} />
        )
      )}
    </div>
  );
}

export function ChartCardSkeleton({
  className = '',
  height = 'h-72',
}: {
  className?: string;
  height?: string;
}) {
  return (
    <section className={`card-dark rounded-3xl p-6 ${className}`}>
      <div className="mb-4 space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className={`${height} w-full rounded-2xl`} />
    </section>
  );
}

/** Table rows only; sits inside the page's existing table card. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden">
      <div className="flex gap-4 border-b border-border px-4 py-3">
        {range(cols).map((j) => (
          <Skeleton key={j} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {range(rows).map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            {range(cols).map((j) => (
              <Skeleton key={j} className={`h-5 flex-1 ${j === 0 ? 'max-w-[11rem]' : ''}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stacked item cards (inventory items, orders, inquiries). */
export function ListSkeleton({ rows = 5, dense = false }: { rows?: number; dense?: boolean }) {
  return (
    <div className={dense ? 'space-y-2' : 'space-y-3'}>
      {range(rows).map((i) => (
        <div
          key={i}
          className={`flex items-center justify-between gap-4 border border-border bg-card ${dense ? 'rounded-2xl p-4' : 'rounded-3xl p-5'}`}
        >
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton
              className={`shrink-0 ${dense ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'}`}
            />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Product cards (catalog, shop). */
export function CardGridSkeleton({
  count = 6,
  className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6',
  imageClass = 'h-48',
}: {
  count?: number;
  className?: string;
  imageClass?: string;
}) {
  return (
    <div className={className}>
      {range(count).map((i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card"
        >
          <Skeleton className={`${imageClass} w-full rounded-none`} />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Message bubbles for a chat thread. */
export function ChatSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {range(rows).map((i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
          <Skeleton className={`h-12 rounded-2xl ${i % 2 ? 'w-1/2' : 'w-2/3'}`} />
        </div>
      ))}
    </div>
  );
}

/** Generic content card: title + a few text lines. */
export function PanelSkeleton({
  lines = 4,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 space-y-3 ${className}`}>
      <Skeleton className="h-5 w-40" />
      {range(lines).map((i) => (
        <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

/* ---------- page layouts (used by route loading.tsx and in-page loading) ---------- */

/** Admin overview / production monitor: KPIs, chart row, table + feed row. */
export function DashboardSkeleton() {
  return (
    <SkeletonRegion label="Loading dashboard" className="space-y-6">
      <PageHeaderSkeleton actions={2} />
      <StatCardsSkeleton />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCardSkeleton className="xl:col-span-2" />
        <ChartCardSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card-dark rounded-3xl p-6 xl:col-span-2">
          <Skeleton className="mb-5 h-5 w-40" />
          <TableSkeleton rows={5} />
        </section>
        <section className="card-dark rounded-3xl p-6 space-y-3">
          <Skeleton className="mb-2 h-5 w-32" />
          {range(4).map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-3xl" />
          ))}
        </section>
      </div>
    </SkeletonRegion>
  );
}

/** Back-compat name for the generic page loader. */
export const PageSkeleton = DashboardSkeleton;

/** Header, optional stats/filters, then a table card (users, audit logs, rework). */
export function TablePageSkeleton({
  stats = 0,
  search = false,
  chips = 0,
  cols = 5,
  rows = 8,
}: {
  stats?: number;
  search?: boolean;
  chips?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <SkeletonRegion label="Loading page" className="space-y-6">
      <PageHeaderSkeleton />
      {stats > 0 && (
        <StatCardsSkeleton
          count={stats}
          compact
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        />
      )}
      {(search || chips > 0) && <FilterBarSkeleton search={search} chips={chips} />}
      <div className="card-dark rounded-3xl overflow-hidden">
        <TableSkeleton rows={rows} cols={cols} />
      </div>
    </SkeletonRegion>
  );
}

/** Header, search + category chips, product grid (catalog, shop). */
export function CardGridPageSkeleton({
  gridClass,
  imageClass,
}: {
  gridClass?: string;
  imageClass?: string;
}) {
  return (
    <SkeletonRegion label="Loading products" className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton search chips={5} />
      <CardGridSkeleton className={gridClass} imageClass={imageClass} />
    </SkeletonRegion>
  );
}

/** Header, filters, item list beside a side panel (inventory). */
export function ListPageSkeleton() {
  return (
    <SkeletonRegion label="Loading inventory" className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton search chips={4} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ListSkeleton rows={6} />
        </div>
        <PanelSkeleton lines={6} className="rounded-3xl" />
      </div>
    </SkeletonRegion>
  );
}

/** Header, tabs, conversation list beside a thread (messages, inquiries). */
export function MessagesPageSkeleton() {
  return (
    <SkeletonRegion label="Loading messages" className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton chips={3} />
      <div className="flex flex-col gap-4 xl:flex-row">
        <div className="xl:w-[40%]">
          <ListSkeleton rows={5} dense />
        </div>
        <div className="flex-1 rounded-3xl border border-border bg-card p-4">
          <ChatSkeleton rows={6} />
          <Skeleton className="mt-6 h-11 w-full rounded-xl" />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Header with filter chips, then list beside a detail panel (order management). */
export function SplitPageSkeleton() {
  return (
    <SkeletonRegion label="Loading orders" className="space-y-6">
      <PageHeaderSkeleton eyebrow />
      <FilterBarSkeleton chips={6} />
      <SplitContentSkeleton />
    </SkeletonRegion>
  );
}

export function SplitContentSkeleton() {
  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <section className="card-dark rounded-3xl p-6 xl:w-[55%]">
        <Skeleton className="mb-5 h-5 w-36" />
        <ListSkeleton rows={5} dense />
      </section>
      <section className="card-dark flex-1 rounded-3xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </section>
    </div>
  );
}

/** Customer overview: order list beside the selected order's detail. */
export function CustomerOverviewSkeleton() {
  return (
    <SkeletonRegion label="Loading your orders" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="flex flex-col gap-5 xl:flex-row">
        <div className="xl:w-[38%] space-y-2">
          <Skeleton className="mb-3 h-3 w-24" />
          <ListSkeleton rows={3} dense />
        </div>
        <div className="space-y-4 xl:flex-1">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-5 flex items-center gap-4">
              <Skeleton className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              {range(8).map((i) => (
                <Skeleton key={i} className="h-9 w-9 rounded-full" />
              ))}
            </div>
          </div>
          <PanelSkeleton lines={3} />
          <PanelSkeleton lines={4} />
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Customer order history: header, order picker, tab bar, detail card. */
export function OrderViewSkeleton() {
  return (
    <SkeletonRegion label="Loading order" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card p-1.5">
        {range(4).map((i) => (
          <Skeleton key={i} className="h-9 rounded-xl" />
        ))}
      </div>
      <PanelSkeleton lines={5} />
      <PanelSkeleton lines={3} />
    </SkeletonRegion>
  );
}

/** Staff workshop: timer + stage panel, task list + quick actions, QA feed. */
export function WorkshopSkeleton() {
  return (
    <SkeletonRegion label="Loading workshop" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl" />
        <PanelSkeleton lines={5} className="lg:col-span-2" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListSkeleton rows={3} />
        </div>
        <div className="grid grid-cols-2 content-start gap-3">
          {range(4).map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
      <PanelSkeleton lines={4} />
    </SkeletonRegion>
  );
}

/** Quality scan: header, mode tabs, camera viewport beside results. */
export function ScanPageSkeleton() {
  return (
    <SkeletonRegion label="Loading quality scan" className="space-y-6">
      <PageHeaderSkeleton />
      <FilterBarSkeleton chips={4} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="aspect-video w-full rounded-3xl xl:col-span-2" />
        <PanelSkeleton lines={6} className="rounded-3xl" />
      </div>
    </SkeletonRegion>
  );
}

/** Two-column grid of report / summary cards. */
export function ReportCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {range(count).map((i) => (
        <div key={i} className="card-dark rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      ))}
    </div>
  );
}
