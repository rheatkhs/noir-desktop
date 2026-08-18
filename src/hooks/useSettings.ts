import { useState, useEffect, useCallback } from "react";
import { Store } from "@tauri-apps/plugin-store";
import type { AppSettings } from "../types";

const DEFAULT_SETTINGS: AppSettings = {
  provider: "openai",
  model: "gpt-4o",
  api_key: "",
  base_url: "",
  max_tokens: 4096,
  temperature: 0.7,
  escape_plan_mode: false,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    const init = async () => {
      const s = await Store.load("settings.json");
      setStore(s);

      const loaded: AppSettings = { ...DEFAULT_SETTINGS };
      for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
        const val = await s.get(key);
        if (val !== null && val !== undefined) {
          (loaded as unknown as Record<string, unknown>)[key] = val;
        }
      }
      setSettings(loaded);
      setIsLoading(false);
    };
    init();
  }, []);

  const saveSettings = useCallback(
    async (newSettings: AppSettings) => {
      if (!store) return;
      for (const [key, value] of Object.entries(newSettings)) {
        await store.set(key, value);
      }
      await store.save();
      setSettings(newSettings);
    },
    [store],
  );

  return { settings, saveSettings, isLoading };
}
