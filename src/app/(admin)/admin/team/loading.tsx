import {
  SkeletonRegion,
  PageHeaderSkeleton,
  PanelSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading team" className="space-y-6">
      <PageHeaderSkeleton eyebrow={false} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PanelSkeleton lines={6} className="xl:col-span-2 rounded-3xl" />
        <PanelSkeleton lines={5} className="rounded-3xl" />
      </div>
      <StatCardsSkeleton compact />
      <div className="card-dark rounded-3xl overflow-hidden">
        <TableSkeleton rows={6} />
      </div>
    </SkeletonRegion>
  );
}
