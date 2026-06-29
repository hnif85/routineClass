import { createServerSupabase } from "@/lib/supabase/server";

export interface AppConfig {
  app_name: string;
  app_short_name: string;
  brand_name: string;
  brand_short_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  og_image_url: string;
  meta_title: string;
  meta_description: string;
  footer_text: string;
  wa_bot_name: string;
  wa_bot_phone: string;
  welcome_message: string;
  version: string;
  feature_portal_umkm: boolean;
  feature_sosmed_scrape: boolean;
  feature_agentic_query: boolean;
  feature_sertifikat_auto: boolean;
}

// Cache config untuk hindari query berulang
let cachedConfig: AppConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 menit

export async function getAppConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (cachedConfig && now - cacheTime < CACHE_TTL) {
    return cachedConfig;
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value, type");

  if (error || !data) {
    console.error("Failed to load app config:", error);
    return getDefaultConfig();
  }

  const rawConfig: Record<string, string> = {};
  for (const row of data) {
    rawConfig[row.key] = row.value;
  }

  cachedConfig = {
    app_name: rawConfig.app_name || "UMKM Connect",
    app_short_name: rawConfig.app_short_name || "UMKM Connect",
    brand_name: rawConfig.brand_name || "Pupuk Kaltim",
    brand_short_name: rawConfig.brand_short_name || "PKT",
    primary_color: rawConfig.primary_color || "#1B5E20",
    secondary_color: rawConfig.secondary_color || "#FF8F00",
    accent_color: rawConfig.accent_color || "#0D5302",
    logo_url: rawConfig.logo_url || "/assets/default-logo.png",
    favicon_url: rawConfig.favicon_url || "/assets/favicon.ico",
    og_image_url: rawConfig.og_image_url || "/assets/og-default.png",
    meta_title: rawConfig.meta_title || "UMKM Connect — Pupuk Kaltim",
    meta_description:
      rawConfig.meta_description ||
      "Sistem Informasi & Monitoring UMKM Binaan Pupuk Kaltim",
    footer_text: rawConfig.footer_text || "© 2026 PT Pupuk Kalimantan Timur",
    wa_bot_name: rawConfig.wa_bot_name || "Kak Tani",
    wa_bot_phone: rawConfig.wa_bot_phone || "",
    welcome_message:
      rawConfig.welcome_message ||
      "Halo! Saya Kak Tani, asisten virtual Pupuk Kaltim.",
    version: rawConfig.version || "1.0.0",
    feature_portal_umkm: rawConfig.feature_portal_umkm === "true",
    feature_sosmed_scrape: rawConfig.feature_sosmed_scrape === "true",
    feature_agentic_query: rawConfig.feature_agentic_query === "true",
    feature_sertifikat_auto: rawConfig.feature_sertifikat_auto === "true",
  };
  cacheTime = now;
  return cachedConfig;
}

function getDefaultConfig(): AppConfig {
  return {
    app_name: "UMKM Connect",
    app_short_name: "UMKM Connect",
    brand_name: "Pupuk Kaltim",
    brand_short_name: "PKT",
    primary_color: "#1B5E20",
    secondary_color: "#FF8F00",
    accent_color: "#0D5302",
    logo_url: "/assets/default-logo.png",
    favicon_url: "/assets/favicon.ico",
    og_image_url: "/assets/og-default.png",
    meta_title: "UMKM Connect — Pupuk Kaltim",
    meta_description: "Sistem Informasi & Monitoring UMKM Binaan Pupuk Kaltim",
    footer_text: "© 2026 PT Pupuk Kalimantan Timur",
    wa_bot_name: "Kak Tani",
    wa_bot_phone: "",
    welcome_message: "Halo! Saya Kak Tani, asisten virtual Pupuk Kaltim.",
    version: "1.0.0",
    feature_portal_umkm: false,
    feature_sosmed_scrape: false,
    feature_agentic_query: false,
    feature_sertifikat_auto: false,
  };
}
