import React, { createContext, useContext, useState, useCallback } from 'react';

const LS_KEY = 'cacheTtlHours';
const DEFAULT_TTL_HOURS = 4;

interface SettingsContextValue {
  cacheTtlHours: number;
  setCacheTtlHours: (hours: number) => void;
  staleTimeMs: number;
}

const SettingsContext = createContext<SettingsContextValue>({
  cacheTtlHours: DEFAULT_TTL_HOURS,
  setCacheTtlHours: () => {},
  staleTimeMs: DEFAULT_TTL_HOURS * 60 * 60 * 1000,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [cacheTtlHours, setCacheTtlHoursState] = useState<number>(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return DEFAULT_TTL_HOURS;
  });

  const setCacheTtlHours = useCallback((hours: number) => {
    const clamped = Math.max(1, Math.min(24, hours));
    setCacheTtlHoursState(clamped);
    localStorage.setItem(LS_KEY, String(clamped));
  }, []);

  const staleTimeMs = cacheTtlHours * 60 * 60 * 1000;

  return (
    <SettingsContext.Provider value={{ cacheTtlHours, setCacheTtlHours, staleTimeMs }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function getInitialTtlMs(): number {
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!isNaN(parsed) && parsed > 0) return parsed * 60 * 60 * 1000;
  }
  return DEFAULT_TTL_HOURS * 60 * 60 * 1000;
}
