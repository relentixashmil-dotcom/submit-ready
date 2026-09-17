import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "submitready-theme";
const listeners = new Set<() => void>();

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
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
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode: the class is still applied for this session.
  }
  emit();
}

/** Reads the theme applied by the inline bootstrap script in index.html. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  const setTheme = useCallback((next: Theme) => apply(next), []);
  const toggleTheme = useCallback(
    () => apply(currentTheme() === "dark" ? "light" : "dark"),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
