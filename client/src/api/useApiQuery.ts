import { useCallback, useEffect, useState } from 'react';

import { api } from './client';
import { useCurrentUser } from '@/context/CurrentUser';

type UseApiQueryResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

// path: string | null lets the form page call this unconditionally and pass
// null in create mode, rather than conditionally calling a hook (ADR §8).
export function useApiQuery<T>(path: string | null): UseApiQueryResult<T> {
  const { currentUser } = useCurrentUser();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    api
      .get<T>(path, controller.signal)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // superseded by a newer request, not a failure
        }
        setError(err instanceof Error ? err : new Error('Something went wrong'));
        setLoading(false);
      });

    return () => controller.abort();
    // currentUser.id is what makes "switching users refetches the page" true.
  }, [path, currentUser?.id, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { data, loading, error, refetch };
}