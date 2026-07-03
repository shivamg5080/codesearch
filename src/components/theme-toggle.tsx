"use client";

import { useSyncExternalStore } from "react";

// The <html> class is the source of truth (set pre-paint in the layout);
// subscribe to it so any toggle instance stays in sync.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/** Sun/moon switch for the class-based theme; persists to localStorage. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => true, // server snapshot: dark is the default
  );

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-(--border) text-sm text-(--muted) transition hover:border-(--border-hover) hover:text-(--text)"
    >
      {dark ? "☾" : "☀"}
    </button>
  );
}
