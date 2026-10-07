import { TablePageSkeleton } from '@/components/ui/LoadingSkeleton';

export default function Loading() {
  return <TablePageSkeleton stats={4} chips={5} cols={6} />;
}
