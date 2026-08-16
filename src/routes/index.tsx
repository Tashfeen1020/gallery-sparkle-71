import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, dictionaries, LANGS, type Category, type Lang } from "@/lib/i18n";
import { compressImage, makeThumbDataUrl } from "@/lib/compress";
import { categorizePhoto } from "@/lib/categorize.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixel Vault — Shared Photo Gallery" },
      {
        name: "description",
        content:
          "Upload photos with your name and a 4-digit PIN, browse a responsive gallery, favourite and search photos.",
      },
      { property: "og:title", content: "Pixel Vault — Shared Photo Gallery" },
      {
        property: "og:description",
        content: "Public photo uploads with PIN-protected delete, favourites and search.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Photo = {
  id: string;
  uploader_name: string;
  storage_path: string;
  file_name: string;
  category: Category;
  created_at: string;
  signedUrl: string;
};

const FAV_KEY = "pixel-vault-favourites";
const THEME_KEY = "pixel-vault-theme";
const LANG_KEY = "pixel-vault-lang";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
}

function Index() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lang, setLang] = useState<Lang>("en");

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [stage, setStage] = useState<"compress" | "analyze" | "upload">("upload");
  const [category, setCategory] = useState<Category | "All">("All");
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const t = dictionaries[lang];
  const rtl = lang === "ar";

  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(FAV_KEY);
    if (stored) setFavourites(JSON.parse(stored) as string[]);
    const st = localStorage.getItem(THEME_KEY);
    if (st === "light" || st === "dark") setTheme(st);
    const sl = localStorage.getItem(LANG_KEY);
    if (sl === "en" || sl === "bn" || sl === "ar") setLang(sl);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos_public")
      .select("id, uploader_name, storage_path, file_name, category, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      notify(dictionaries[lang].loadFailed(error.message), true);
      setLoading(false);
      return;
    }

    const rows = data ?? [];
    const paths = rows.map((r) => r.storage_path as string);
    let urls: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("photos")
        .createSignedUrls(paths, 60 * 60 * 24);
      urls = Object.fromEntries(
        (signed ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""]),
      );
    }

    setPhotos(
      rows.map((r) => ({
        id: r.id as string,
        uploader_name: r.uploader_name as string,
        storage_path: r.storage_path as string,
        file_name: r.file_name as string,
        category: (CATEGORIES as readonly string[]).includes(r.category ?? "")
          ? (r.category as Category)
          : "Other",
        created_at: r.created_at as string,
        signedUrl: urls[r.storage_path as string] ?? "",
      })),
    );
    setLoading(false);
  }, [notify, lang]);

  useEffect(() => {
    void loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return notify(t.pinFourDigits, true);
    if (!file) return notify(t.chooseFile, true);
    if (!file.type.startsWith("image/")) return notify(t.onlyImages, true);

    setUploading(true);
    try {
      setStage("compress");
      const optimized = await compressImage(file);

      setStage("analyze");
      let detected: Category = "Other";
      try {
        const thumb = await makeThumbDataUrl(optimized);
        const res = await categorizePhoto({ data: { dataUrl: thumb } });
        detected = res.category as Category;
      } catch (aiErr) {
        console.error("[categorize] failed", aiErr);
        notify(String(aiErr), true);
      }

      setStage("upload");
      const safeName = optimized.name.replace(/[^\w.-]/g, "_");
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, optimized, { contentType: optimized.type });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("photos").insert({
        uploader_name: name.trim() || "Anonymous",
        pin_hash: pin,
        url: path,
        storage_path: path,
        file_name: file.name,
        category: detected,
      });
      if (dbErr) {
        await supabase.storage.from("photos").remove([path]);
        throw dbErr;
      }

      setName("");
      setPin("");
      setFile(null);
      setFileKey((k) => k + 1);
      notify(t.uploaded);
      await loadPhotos();
    } catch (err) {
      notify(t.uploadFailed((err as Error).message), true);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: Photo) {
    const entered = window.prompt(t.pinPrompt);
    if (entered === null) return;
    if (!/^\d{4}$/.test(entered.trim())) return notify(t.pinFourDigits, true);

    const { data, error } = await supabase.rpc("delete_photo", {
      p_id: photo.id,
      p_pin: entered.trim(),
    });

    if (error) return notify(t.deleteFailed(error.message), true);
    if (!data) return notify(t.wrongPin, true);

    const { error: rmErr } = await supabase.storage.from("photos").remove([data as string]);
    if (rmErr) notify(t.cleanupFailed(rmErr.message), true);
    else notify(t.deleted);

    setFavourites((f) => f.filter((id) => id !== photo.id));
    setPhotos((p) => p.filter((x) => x.id !== photo.id));
  }

  async function handleSave(photo: Photo) {
    try {
      const { data, error } = await supabase.storage
        .from("photos")
        .download(photo.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.file_name || "photo.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify(t.saved);
    } catch (err) {
      notify(t.saveFailed((err as Error).message), true);
    }
  }

  function toggleFavourite(id: string) {
    setFavourites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return photos.filter((p) => {
      if (favOnly && !favourites.includes(p.id)) return false;
      if (category !== "All" && p.category !== category) return false;
      if (!term) return true;
      return `${p.uploader_name} ${p.file_name}`.toLowerCase().includes(term);
    });
  }, [photos, search, favOnly, favourites, category]);

  const usedCategories = useMemo(
    () => CATEGORIES.filter((c) => photos.some((p) => p.category === c)),
    [photos],
  );

  return (
    <main className="app-backdrop min-h-screen" dir={rtl ? "rtl" : "ltr"}>
      <div className="fx-ambient" aria-hidden="true">
        <div className="fx-blob fx-blob-1" />
        <div className="fx-blob fx-blob-2" />
        <div className="fx-blob fx-blob-3" />
        {theme === "dark" && <div className="fx-particles" />}
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        <div className="mb-4 flex items-center justify-end gap-2">
          <label className="sr-only" htmlFor="lang">
            {t.language}
          </label>
          <select
            id="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            aria-label={t.language}
            className="rounded-full border border-border bg-input px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            title={t.theme}
            aria-label={t.theme}
            className="grid h-10 w-10 place-items-center rounded-full border border-border bg-input text-foreground transition duration-300 hover:border-primary hover:text-primary hover:rotate-12"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>

        <header className="mb-6 text-center">
          <h1 className="text-gradient font-display text-4xl font-bold sm:text-5xl">{t.title}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">{t.tagline}</p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          <form
            onSubmit={handleUpload}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="grid gap-1.5">
              <label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.uploaderName}
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                placeholder={t.namePlaceholder}
                className="rounded-xl border border-border bg-input px-3.5 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="file" className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.photo}
              </label>
              <input
                id="file"
                key={fileKey}
                type="file"
                accept="image/*"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-border bg-input px-3.5 py-2.5 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="pin" className="text-xs uppercase tracking-wider text-muted-foreground">
                {t.secretPin}
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="rounded-xl border border-border bg-input px-3.5 py-3 tracking-[0.4em] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="btn-hero rounded-xl px-6 py-3 font-semibold transition hover:brightness-110 disabled:opacity-60"
            >
              {uploading
                ? stage === "compress"
                  ? t.compressing
                  : stage === "analyze"
                    ? t.analyzing
                    : t.uploading
                : t.upload}
            </button>
          </form>
        </section>

        <div className="my-7 flex flex-wrap items-center gap-3">
          <div className="rainbow-ring min-w-[260px] flex-1 rounded-full p-0.5">
            <div className="relative">
              <span
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm ${
                  rtl ? "right-4" : "left-4"
                }`}
              >
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className={`w-full rounded-full bg-input py-3 text-foreground outline-none ${
                  rtl ? "pr-10 pl-4" : "pl-10 pr-4"
                }`}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            className={`rounded-full border px-5 py-3 font-semibold transition ${
              favOnly
                ? "border-transparent bg-gold text-background"
                : "border-border bg-input text-muted-foreground"
            }`}
          >
            ★ {t.favouritesOnly}
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["All", ...usedCategories] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c as Category | "All")}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                category === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-input text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {c === "All" ? t.allCategories : t.categoryNames[c as Category]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">{t.loading}</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {photos.length ? t.noMatch : t.empty}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => setLightbox(p)}
                  title={t.viewPhoto}
                  aria-label={t.viewPhoto}
                  className="group relative block w-full overflow-hidden"
                >
                  <img
                    src={p.signedUrl}
                    alt={t.altPhoto(p.uploader_name)}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-background/75 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                    {t.categoryNames[p.category]}
                  </span>
                  <span className="absolute inset-0 grid place-items-center bg-background/55 text-sm font-semibold opacity-0 backdrop-blur-[2px] transition group-hover:opacity-100">
                    🔎 {t.viewPhoto}
                  </span>
                </button>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.uploader_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString(
                        lang === "bn" ? "bn-BD" : lang === "ar" ? "ar-EG" : "en-US",
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      title={t.toggleFavourite}
                      aria-label={t.toggleFavourite}
                      onClick={() => toggleFavourite(p.id)}
                      className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
                        favourites.includes(p.id)
                          ? "border-gold bg-gold/20 text-gold"
                          : "border-border bg-input text-muted-foreground"
                      }`}
                    >
                      {favourites.includes(p.id) ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      title={t.savePhoto}
                      aria-label={t.savePhoto}
                      onClick={() => void handleSave(p)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-input text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      ⬇
                    </button>
                    <button
                      type="button"
                      title={t.deletePhoto}
                      aria-label={t.deletePhoto}
                      onClick={() => void handleDelete(p)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-input transition hover:border-destructive hover:text-destructive"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.viewPhoto}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <img
              src={lightbox.signedUrl}
              alt={t.altPhoto(lightbox.uploader_name)}
              className="max-h-[70vh] w-full bg-black/40 object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-display text-xl font-bold">{lightbox.uploader_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {lightbox.file_name} · {t.categoryNames[lightbox.category]} ·{" "}
                  {new Date(lightbox.created_at).toLocaleDateString(
                    lang === "bn" ? "bn-BD" : lang === "ar" ? "ar-EG" : "en-US",
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave(lightbox)}
                  className="rounded-xl border border-border bg-input px-4 py-2 text-sm font-semibold transition hover:border-primary hover:text-primary"
                >
                  ⬇ {t.savePhoto}
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="btn-hero rounded-xl px-4 py-2 text-sm font-semibold"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border px-5 py-3 shadow-xl ${
            toast.error ? "border-destructive bg-card" : "border-border bg-card"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
