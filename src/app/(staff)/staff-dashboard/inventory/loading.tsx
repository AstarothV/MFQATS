import { SkeletonRegion, PageHeaderSkeleton, PanelSkeleton } from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading inventory" className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PanelSkeleton key={i} lines={3} className="rounded-3xl" />
        ))}
      </div>
    </SkeletonRegion>
  );
}
