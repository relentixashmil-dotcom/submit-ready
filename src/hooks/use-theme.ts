import { useCallback, useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "submitready-theme";
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(theme: Theme) {
  const root = document.documentElement;
  // Dark is the default surface; lighter values live behind `.light`.
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode: the class is still applied for this session.
  }
  emit();
}

/** Reads the theme applied by the inline bootstrap script in index.html. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "dark");

  const setTheme = useCallback((next: Theme) => apply(next), []);
  const toggleTheme = useCallback(
    () => apply(currentTheme() === "dark" ? "light" : "dark"),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
