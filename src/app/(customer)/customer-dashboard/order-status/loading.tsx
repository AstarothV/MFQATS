import { SkeletonRegion, PageHeaderSkeleton, PanelSkeleton } from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading order status" className="space-y-6">
      <PageHeaderSkeleton eyebrow={false} />
      <PanelSkeleton lines={2} />
      <PanelSkeleton lines={7} />
    </SkeletonRegion>
  );
}
