import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "form:";

function getStorageKey(formKey: string): string {
  return `${STORAGE_PREFIX}${formKey}`;
}

export function useFormPersist<T extends Record<string, string>>(
  formKey: string,
  excludeFields: string[] = [],
) {
  const [stored, setStored] = useState<T | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(getStorageKey(formKey));
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStored(parsed);
      }
    } catch {
      // corrupt or missing data — ignore
    }
    setLoaded(true);
  }, [formKey]);

  const save = useCallback(
    (data: Partial<T>) => {
      try {
        const filtered = Object.fromEntries(
          Object.entries(data).filter(([key]) => !excludeFields.includes(key)),
        );
        const existing = localStorage.getItem(getStorageKey(formKey));
        const merged = { ...(existing ? JSON.parse(existing) : {}), ...filtered };

        // Remove keys with empty-string values so we don't bloat storage
        for (const key of Object.keys(merged)) {
          if (merged[key] === "" || merged[key] === undefined || merged[key] === null) {
            delete merged[key];
          }
        }

        if (Object.keys(merged).length === 0) {
          localStorage.removeItem(getStorageKey(formKey));
        } else {
          localStorage.setItem(getStorageKey(formKey), JSON.stringify(merged));
        }
      } catch {
        // storage full or disabled — silently ignore
      }
    },
    [formKey, excludeFields],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey(formKey));
    } catch {
      // ignore
    }
    setStored(null);
  }, [formKey]);

  return { stored, save, clear, loaded };
}