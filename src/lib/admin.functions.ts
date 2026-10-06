import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizeSettings } from "./site-settings";

type AdminSession = { admin?: boolean };

function sessionConfig() {
  return {
    password: process.env["ADMIN_SESSION_SECRET"]!,
    name: "pv-admin",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireAdmin() {
  const session = await useSession<AdminSession>(sessionConfig());
  if (!session.data.admin) throw new Error("Unauthorized");
}

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  return { admin: !!session.data.admin };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) throw new Error("Admin password not configured");
    const input = data.password.trim();
    const stripped = input.replace(/^\[(.*)\]$/, "$1");
    const ok = matches(input, expected) || matches(stripped, expected);
    if (!ok) return { ok: false as const };
    const session = await useSession<AdminSession>(sessionConfig());
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSession>(sessionConfig());
  await session.clear();
  return { ok: true };
});

export const publishSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ settings: z.record(z.string(), z.string()) }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ id: 1, data: normalizeSettings(data.settings), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const forceDeletePhoto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("photos")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("photo_ratings").delete().eq("photo_id", data.id);
    const { error } = await supabaseAdmin.from("photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.storage_path) await supabaseAdmin.storage.from("photos").remove([row.storage_path]);
    return { ok: true };
  });

export const updatePhoto = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        uploader_name: z.string().trim().min(1).max(60).optional(),
        category: z.string().trim().min(1).max(40).optional(),
        storage_path: z.string().min(1).max(300).optional(),
        file_name: z.string().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { data: old } = await supabaseAdmin
      .from("photos")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    const update: { uploader_name?: string; category?: string; storage_path?: string; file_name?: string; url?: string } = {};
    if (patch.uploader_name) update.uploader_name = patch.uploader_name;
    if (patch.category) update.category = patch.category;
    if (patch.file_name) update.file_name = patch.file_name;
    if (patch.storage_path) {
      update.storage_path = patch.storage_path;
      update.url = patch.storage_path;
    }
    const { error } = await supabaseAdmin.from("photos").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    if (patch.storage_path && old?.storage_path && old.storage_path !== patch.storage_path) {
      await supabaseAdmin.storage.from("photos").remove([old.storage_path]);
    }
    return { ok: true };
  });
