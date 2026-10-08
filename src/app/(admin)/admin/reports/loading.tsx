import {
  SkeletonRegion,
  PageHeaderSkeleton,
  ReportCardsSkeleton,
} from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <SkeletonRegion label="Loading reports" className="space-y-6">
      <PageHeaderSkeleton />
      <ReportCardsSkeleton />
    </SkeletonRegion>
  );
}
