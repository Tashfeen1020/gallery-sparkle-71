import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SETTING_KEYS = [
  "brandName",
  "title",
  "tagline",
  "uploadLabel",
  "footerText",
  "background",
  "foreground",
  "accent",
  "accent2",
  "cardBg",
  "cardText",
  "border",
  "mutedText",
  "inputBg",
  "starColor",
  "titleColor",
  "radius",
  "titleFont",
  "bodyFont",
  "animatedBg",
] as const;

export type SiteSettings = Record<(typeof SETTING_KEYS)[number], string>;

export const EMPTY_SETTINGS = Object.fromEntries(SETTING_KEYS.map((k) => [k, ""])) as SiteSettings;

export function normalizeSettings(raw: unknown): SiteSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_SETTINGS };
  for (const k of SETTING_KEYS) {
    if (typeof o[k] === "string") out[k] = (o[k] as string).slice(0, 400);
  }
  return out;
}

/** Applies colour/style overrides as CSS variables on the page root. */
export function applyTheme(s: SiteSettings) {
  const root = document.documentElement.style;
  const map: [keyof SiteSettings, string[]][] = [
    ["background", ["--background"]],
    ["foreground", ["--foreground"]],
    ["accent", ["--primary", "--ring", "--cyan"]],
    ["accent2", ["--pink"]],
    ["cardBg", ["--card", "--popover"]],
    ["cardText", ["--card-foreground", "--popover-foreground"]],
    ["border", ["--border"]],
    ["mutedText", ["--muted-foreground"]],
    ["inputBg", ["--input"]],
    ["starColor", ["--gold"]],
  ];
  for (const [key, vars] of map) {
    for (const v of vars) {
      if (s[key]) root.setProperty(v, s[key]);
      else root.removeProperty(v);
    }
  }
  if (s.radius) root.setProperty("--radius", `${Number(s.radius) || 14}px`);
  else root.removeProperty("--radius");
  if (s.titleFont) root.setProperty("--pv-title-font", s.titleFont);
  else root.removeProperty("--pv-title-font");
  if (s.bodyFont) root.setProperty("--pv-body-font", s.bodyFont);
  else root.removeProperty("--pv-body-font");
  document.documentElement.classList.toggle("no-fx", s.animatedBg === "off");
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
