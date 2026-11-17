import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './session';

export type Resource<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
  update: (value: T | ((current: T | undefined) => T)) => void;
};

/**
 * Carga asíncrona con estados de `loading`/`error` para todas las pantallas.
 * `deps` funciona como la lista de dependencias de `useEffect`.
 */
export function useResource<T>(loader: () => Promise<T>, deps: readonly unknown[]): Resource<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [nonce, setNonce] = useState(0);
  const load = useRef(loader);
  const hasData = useRef(false);
  load.current = loader;

  useEffect(() => {
    let cancelled = false;
    // Un `reload()` después de una mutación no debe volver a mostrar el esqueleto.
    if (!hasData.current) setLoading(true);
    setError(undefined);
    load
      .current()
      .then((value) => {
        if (cancelled) return;
        hasData.current = true;
        setData(value);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'No fue posible cargar la información.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, loading, error, reload, update: setData };
}
