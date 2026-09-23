import { useEffect, useState } from "react";

/** Только пользовательские настройки и демо. Никогда не хранить здесь API-ключи. */
export function useLocalState<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) || "null");
      return validate(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, value]);
  return [value, setValue, storageError] as const;
}
