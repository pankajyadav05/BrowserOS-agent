import React, { useEffect, useState } from "react";
import { AgentInput } from "./components/AgentInput";
import { ThemeToggle } from "./components/ThemeToggle";
import { SettingsDialog } from "./components/SettingsDialog";
import { useSettingsStore } from "@/sidepanel/stores/settingsStore";
import { Settings } from "lucide-react";

export function NewTab() {
  const { theme, fontSize } = useSettingsStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply theme and font size
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-font-size",
      `${fontSize}px`
    );
    const root = document.documentElement;
    root.classList.remove("dark", "gray");
    if (theme === "dark") root.classList.add("dark");
    if (theme === "gray") root.classList.add("gray");
  }, [theme, fontSize]);

  // Listen for theme changes from other tabs/views
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "nxtscape-settings" && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          const newTheme = newSettings?.state?.theme;
          const newFontSize = newSettings?.state?.fontSize;

          // Update theme if changed
          if (newTheme && newTheme !== theme) {
            const root = document.documentElement;
            root.classList.remove("dark", "gray");
            if (newTheme === "dark") root.classList.add("dark");
            if (newTheme === "gray") root.classList.add("gray");
            useSettingsStore.setState({ theme: newTheme });
          }

          // Update font size if changed
          if (newFontSize && newFontSize !== fontSize) {
            document.documentElement.style.setProperty(
              "--app-font-size",
              `${newFontSize}px`
            );
            useSettingsStore.setState({ fontSize: newFontSize });
          }
        } catch (err) {
          console.error("Failed to parse settings from storage:", err);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [theme, fontSize]);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Top Left - Logo */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
        <img src="/assets/mitria.svg" alt="Mitria" className="w-10 h-10" />
        <span className="text-2xl font-medium text-foreground tracking-tight">
          Mitria
        </span>
      </div>

      {/* Top Right - Settings and Theme Toggle */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <button
          type="button"
          className="p-2.5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/50 text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Settings"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings size={22} />
        </button>
        <ThemeToggle />
      </div>

      {/* Centered Content */}
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-3xl">
          <AgentInput />
        </div>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
