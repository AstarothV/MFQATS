import {
  SkeletonRegion,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  ChartCardSkeleton,
} from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading defect analytics" className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton compact className="grid grid-cols-2 md:grid-cols-4 gap-4" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <ChartCardSkeleton height="h-64" />
    </SkeletonRegion>
  );
}
