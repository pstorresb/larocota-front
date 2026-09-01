"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("larocota-theme", next);
    setTheme(next);
  }

  return (
    <button className="theme-toggle" type="button" aria-label={theme === "light" ? "Activar tema oscuro" : "Activar tema claro"} onClick={toggle}>
      {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
}
