import {
  SkeletonRegion,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  SplitContentSkeleton,
} from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading order workflow" className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6">
        <PageHeaderSkeleton eyebrow={false} />
      </div>
      <PageHeaderSkeleton />
      <FilterBarSkeleton chips={6} />
      <SplitContentSkeleton />
    </SkeletonRegion>
  );
}
