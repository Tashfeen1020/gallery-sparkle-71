import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  brandName: string;
  title: string;
  tagline: string;
  uploadLabel: string;
  footerText: string;
  background: string;
  foreground: string;
  accent: string;
  accent2: string;
};

export const EMPTY_SETTINGS: SiteSettings = {
  brandName: "",
  title: "",
  tagline: "",
  uploadLabel: "",
  footerText: "",
  background: "",
  foreground: "",
  accent: "",
  accent2: "",
};

export function normalizeSettings(raw: unknown): SiteSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_SETTINGS };
  for (const k of Object.keys(out) as (keyof SiteSettings)[]) {
    if (typeof o[k] === "string") out[k] = (o[k] as string).slice(0, 400);
  }
  return out;
}

/** Applies colour overrides as CSS variables on the page root. */
export function applyTheme(s: SiteSettings) {
  const root = document.documentElement.style;
  const map: [keyof SiteSettings, string[]][] = [
    ["background", ["--background"]],
    ["foreground", ["--foreground", "--card-foreground"]],
    ["accent", ["--primary", "--ring", "--cyan"]],
    ["accent2", ["--pink"]],
  ];
  for (const [key, vars] of map) {
    for (const v of vars) {
      if (s[key]) root.setProperty(v, s[key]);
      else root.removeProperty(v);
    }
  }
}

/** Live site settings: loads once and subscribes to realtime publishes. */
export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY_SETTINGS);
  useEffect(() => {
    let active = true;
    void supabase
      .from("site_settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setSettings(normalizeSettings(data.data));
      });
    const channel = supabase
      .channel("site-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        (payload) => {
          const row = payload.new as { data?: unknown } | undefined;
          if (row?.data !== undefined) setSettings(normalizeSettings(row.data));
        },
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);
  return settings;
}
