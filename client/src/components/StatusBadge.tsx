import type { Status } from 'shared/types';

import { Badge } from '@/components/ui/badge';

// The shadcn Badge variants are semantic (default/secondary/destructive), not
// per-status, so the four workflow colours are spelled out here to match the
// mockup rather than bent out of the existing variants.
const STATUS_STYLES: Record<Status, string> = {
  Draft: 'border-neutral-200 bg-neutral-100 text-neutral-600',
  Submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  Approved: 'border-green-200 bg-green-50 text-green-700',
  Rejected: 'border-red-200 bg-red-50 text-red-700',
};

export default function StatusBadge({ status }: { status: Status }) {
  return <Badge className={STATUS_STYLES[status]}>{status}</Badge>;
}
