"use client";
import { useEffect, useState } from "react";
import { useStoreRevision } from "./events";

export interface DataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Load from IndexedDB on mount and after any store change (unless `live: false`). Pass `deps` for query inputs. */
export function useData<T>(loader: () => Promise<T>, deps: readonly unknown[] = [], opts: { live?: boolean } = {}): DataState<T> {
  const liveRev = useStoreRevision();
  const rev = opts.live === false ? 0 : liveRev;
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Omit<DataState<T>, "reload">>({ data: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    loader()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => !cancelled && setState({ data: null, loading: false, error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, tick, ...deps]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
