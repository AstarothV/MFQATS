import { CardGridPageSkeleton } from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return (
    <CardGridPageSkeleton
      gridClass="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
      imageClass="h-44"
    />
  );
}
