import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminLogin,
  adminLogout,
  adminStatus,
  forceDeletePhoto,
  updatePhoto,
  publishSettings,
} from "@/lib/admin.functions";
import { EMPTY_SETTINGS, normalizeSettings, type SiteSettings } from "@/lib/site-settings";
import { compressImage, makeThumbDataUrl } from "@/lib/compress";
import { categorizePhoto } from "@/lib/categorize.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Control Panel — Pixel Vault" },
      { name: "description", content: "Private admin panel for managing the Pixel Vault gallery." },
      { property: "og:title", content: "Admin Control Panel — Pixel Vault" },
      { property: "og:description", content: "Private admin panel for Pixel Vault." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(adminStatus);
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");

  useEffect(() => {
    status()
      .then((r) => setState(r.admin ? "open" : "locked"))
      .catch(() => setState("locked"));
  }, [status]);

  return (
    <main className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6">
      {state === "checking" && <p className="py-20 text-center text-muted-foreground">Loading…</p>}
      {state === "locked" && <Gate onUnlock={() => setState("open")} />}
      {state === "open" && <Dashboard onLock={() => setState("locked")} />}
    </main>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const login = useServerFn(adminLogin);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const r = await login({ data: { password: pw } });
      if (r.ok) onUnlock();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-20 grid max-w-sm gap-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
    >
      <h1 className="text-center font-display text-2xl font-bold">🔒 Admin Access</h1>
      <label htmlFor="admin-pw" className="text-xs font-semibold uppercase text-muted-foreground">
        Admin Password
      </label>
      <input
        id="admin-pw"
        type="password"
        autoComplete="current-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="rounded-xl border border-border bg-input px-3.5 py-3 outline-none focus:border-primary"
      />
      {error && <p className="text-sm font-semibold text-destructive">Wrong Password</p>}
      <button disabled={busy} className="btn-hero rounded-xl px-4 py-3 font-semibold disabled:opacity-60">
        {busy ? "Checking…" : "Enter"}
      </button>
      <Link to="/" className="text-center text-sm text-muted-foreground hover:text-primary">
        ← Back to gallery
      </Link>
    </form>
  );
}

type AdminPhoto = { id: string; uploader_name: string; storage_path: string; url: string; category: string; file_name: string };

const TEXT_FIELDS: [keyof SiteSettings, string, boolean][] = [
  ["title", "Site name / main title (e.g. Photo Heaven)", false],
  ["uploadLabel", "Upload button text", false],
  ["footerText", "Footer text", true],
];

const COLOR_FIELDS: [keyof SiteSettings, string, string][] = [
  ["background", "Background", "#16152b"],
  ["foreground", "Text", "#f2f1fa"],
  ["accent", "Accent", "#7c5cff"],
  ["accent2", "Second accent", "#ff4f8b"],
  ["titleColor", "Title colour (solid)", "#ffffff"],
  ["cardBg", "Photo box background", "#24223f"],
  ["cardText", "Photo box text", "#f2f1fa"],
  ["border", "Box borders", "#3a3760"],
  ["mutedText", "Small / secondary text", "#a9a6c8"],
  ["inputBg", "Inputs & buttons", "#1d1c36"],
  ["starColor", "Stars & favourites", "#f5c542"],
];

const FONTS = [
  ["", "Default"],
  ["Georgia, serif", "Georgia (serif)"],
  ["'Times New Roman', serif", "Times (serif)"],
  ["'Trebuchet MS', sans-serif", "Trebuchet"],
  ["Verdana, sans-serif", "Verdana"],
  ["'Courier New', monospace", "Courier (mono)"],
  ["Impact, sans-serif", "Impact"],
];

function Dashboard({ onLock }: { onLock: () => void }) {
  const logout = useServerFn(adminLogout);
  const publish = useServerFn(publishSettings);
  const del = useServerFn(forceDeletePhoto);
  const edit = useServerFn(updatePhoto);
  const [settings, setSettings] = useState<SiteSettings>(EMPTY_SETTINGS);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [msg, setMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase
      .from("photos_public")
      .select("id, uploader_name, storage_path, category, file_name")
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const paths = rows.map((r) => r.storage_path as string);
    const { data: signed } = paths.length
      ? await supabase.storage.from("photos").createSignedUrls(paths, 3600)
      : { data: [] };
    const urls = Object.fromEntries((signed ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""]));
    setPhotos(
      rows.map((r) => ({
        id: r.id as string,
        uploader_name: r.uploader_name as string,
        storage_path: r.storage_path as string,
        url: urls[r.storage_path as string] ?? "",
        category: ((r.category as string | null) ?? "Other") || "Other",
        file_name: (r.file_name as string) ?? "",
      })),
    );
  }, []);

  useEffect(() => {
    void supabase
      .from("site_settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => data && setSettings(normalizeSettings(data.data)));
    void loadPhotos();
  }, [loadPhotos]);

  async function doPublish() {
    setPublishing(true);
    try {
      await publish({ data: { settings } });
      flash("✅ Changes published live");
    } catch (e) {
      flash(`Publish failed: ${(e as Error).message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function doDelete(id: string) {
    if (!window.confirm("Delete this photo permanently?")) return;
    try {
      await del({ data: { id } });
      setPhotos((p) => p.filter((x) => x.id !== id));
      flash("Photo deleted");
    } catch (e) {
      flash(`Delete failed: ${(e as Error).message}`);
    }
  }

  async function doUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const optimized = await compressImage(file);
        let category = "Other";
        try {
          const res = (await categorizePhoto({
            data: { dataUrl: await makeThumbDataUrl(optimized), title: file.name, existing: [] },
          })) as { category?: string } | undefined;
          if (res?.category?.trim()) category = res.category.trim();
        } catch {
          /* fallback to Other */
        }
        const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${optimized.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(path, optimized, { contentType: optimized.type });
        if (upErr) throw upErr;
        const { error } = await supabase.from("photos").insert({
          uploader_name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "Photo",
          url: path,
          storage_path: path,
          file_name: file.name,
          category,
        });
        if (error) throw error;
      }
      setFiles(null);
      setFileKey((k) => k + 1);
      flash("Upload complete");
      await loadPhotos();
    } catch (err) {
      flash(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  const card = "rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5";
  const input =
    "w-full rounded-xl border border-border bg-input px-3 py-2.5 text-foreground outline-none focus:border-primary";

  return (
    <div className="mx-auto grid max-w-6xl gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Admin Control Panel</h1>
        <div className="flex gap-2">
          <Link to="/" className="rounded-xl border border-border bg-input px-4 py-2 text-sm font-semibold">
            View site
          </Link>
          <button
            onClick={async () => {
              await logout();
              onLock();
            }}
            className="rounded-xl border border-border bg-input px-4 py-2 text-sm font-semibold hover:text-destructive"
          >
            Log out
          </button>
        </div>
      </header>

      <button
        onClick={() => void doPublish()}
        disabled={publishing}
        className="btn-hero sticky top-2 z-10 rounded-2xl px-6 py-4 text-lg font-bold shadow-2xl disabled:opacity-60"
      >
        {publishing ? "Publishing…" : "🚀 Publish Changes"}
      </button>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="mb-1 font-display text-lg font-bold">Text & Branding</h2>
          <p className="mb-4 text-xs text-muted-foreground">Leave a field empty to use the default text.</p>
          <div className="grid gap-3">
            {TEXT_FIELDS.map(([key, label, long]) => (
              <label key={key} className="grid gap-1 text-sm font-semibold">
                {label}
                {long ? (
                  <textarea
                    rows={2}
                    value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    className={input}
                  />
                ) : (
                  <input
                    value={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    className={input}
                  />
                )}
              </label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="mb-1 font-display text-lg font-bold">Theme Colours</h2>
          <p className="mb-4 text-xs text-muted-foreground">Reset a colour to go back to the built-in theme.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_FIELDS.map(([key, label, fallback]) => (
              <div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-input p-3">
                <input
                  type="color"
                  aria-label={label}
                  value={settings[key] || fallback}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{settings[key] || "Default"}</p>
                </div>
                {settings[key] && (
                  <button
                    onClick={() => setSettings({ ...settings, [key]: "" })}
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Reset
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-display text-lg font-bold">Layout & Style</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-semibold">
            Corner roundness: {settings.radius || "default"}px
            <input
              type="range"
              min={0}
              max={32}
              value={Number(settings.radius) || 14}
              onChange={(e) => setSettings({ ...settings, radius: e.target.value })}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Title font
            <select value={settings.titleFont} onChange={(e) => setSettings({ ...settings, titleFont: e.target.value })} className={input}>
              {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Body font
            <select value={settings.bodyFont} onChange={(e) => setSettings({ ...settings, bodyFont: e.target.value })} className={input}>
              {FONTS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Animated background
            <select value={settings.animatedBg} onChange={(e) => setSettings({ ...settings, animatedBg: e.target.value })} className={input}>
              <option value="">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
        <button
          onClick={() => setSettings(EMPTY_SETTINGS)}
          className="mt-4 rounded-xl border border-border bg-input px-4 py-2 text-sm font-semibold hover:text-destructive"
        >
          Reset all settings to default
        </button>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-display text-lg font-bold">Media & Gallery ({photos.length})</h2>
        <form onSubmit={doUpload} className="mb-4 flex flex-wrap gap-3">
          <input
            key={fileKey}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground"
          />
          <button disabled={uploading || !files?.length} className="btn-hero rounded-xl px-5 py-2 font-semibold disabled:opacity-60">
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {photos.map((p) => (
            <PhotoEditor
              key={p.id}
              photo={p}
              categories={[...new Set(photos.map((x) => x.category))]}
              onDelete={() => void doDelete(p.id)}
              onSave={async (patch) => {
                try {
                  await edit({ data: { id: p.id, ...patch } });
                  flash("Photo updated");
                  await loadPhotos();
                } catch (e) {
                  flash(`Update failed: ${(e as Error).message}`);
                }
              }}
            />
          ))}
        </div>
      </section>

      {msg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card px-5 py-3 shadow-xl">
          {msg}
        </div>
      )}
    </div>
  );
}

function PhotoEditor({
  photo,
  categories,
  onDelete,
  onSave,
}: {
  photo: AdminPhoto;
  categories: string[];
  onDelete: () => void;
  onSave: (patch: { uploader_name?: string; category?: string; storage_path?: string; file_name?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(photo.uploader_name);
  const [cat, setCat] = useState(photo.category);
  const [busy, setBusy] = useState(false);
  const field = "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary";
  const listId = `cats-${photo.id}`;

  async function replaceFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    try {
      const optimized = await compressImage(file);
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${optimized.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("photos").upload(path, optimized, { contentType: optimized.type });
      if (error) throw error;
      await onSave({ storage_path: path, file_name: file.name });
    } finally {
      setBusy(false);
    }
  }

  const dirty = name.trim() !== photo.uploader_name || cat.trim() !== photo.category;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-input">
      <img src={photo.url} alt={photo.uploader_name} loading="lazy" className="aspect-square w-full object-cover" />
      <div className="grid gap-1.5 p-2">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Photo name" className={field} />
        <input value={cat} onChange={(e) => setCat(e.target.value)} list={listId} aria-label="Category" className={field} />
        <datalist id={listId}>
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
        <label className="cursor-pointer rounded-lg border border-dashed border-border px-2 py-1 text-center text-[11px] text-muted-foreground hover:text-primary">
          {busy ? "Replacing…" : "Change file"}
          <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => void replaceFile(e.target.files?.[0])} />
        </label>
        <div className="flex gap-1.5">
          <button
            disabled={!dirty || busy || !name.trim() || !cat.trim()}
            onClick={async () => {
              setBusy(true);
              await onSave({ uploader_name: name.trim(), category: cat.trim() });
              setBusy(false);
            }}
            className="flex-1 rounded-lg bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
          >
            Save
          </button>
          <button onClick={onDelete} className="rounded-lg bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
