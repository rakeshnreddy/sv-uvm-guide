"use client";

import { useEffect, useState } from "react";

export const useAsync = <T,>(fn: () => Promise<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fn()
      .then((res) => {
        if (mounted) setData(res);
      })
      .catch((e) => {
        if (mounted) setError(e as Error);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fn]);

  return { data, loading, error };
};

export default useAsync;
