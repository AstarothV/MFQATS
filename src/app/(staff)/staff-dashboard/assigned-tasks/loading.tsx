import { SkeletonRegion, PageHeaderSkeleton, ListSkeleton } from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading tasks" className="space-y-6">
      <PageHeaderSkeleton eyebrow={false} />
      <ListSkeleton rows={5} />
    </SkeletonRegion>
  );
}
