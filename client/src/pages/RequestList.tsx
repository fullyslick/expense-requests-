import { useApiQuery } from '@/api/useApiQuery';
import type { ExpenseRequest } from 'shared/types';

// Temporary stub wiring for Phase 10's "switching users refetches the
// current page" verify step — Phase 11 replaces this with the real table.
export default function RequestList() {
  const { data, loading, error } = useApiQuery<ExpenseRequest[]>('/requests');

  return (
    <div className="p-6">
      <h1>Requests</h1>
      {loading && <p>Loading...</p>}
      {error && <p>{error.message}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}