import { useEffect, useState } from "react";

// Returns value, but only after it has stopped changing for `delay` ms.
// Used to avoid a Places proxy call on every keystroke (cost control, per docs/SETUP.md).
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
