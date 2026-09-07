import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabel, dictionaries, LANGS, type Category, type Lang } from "@/lib/i18n";
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
  description: string;
  created_at: string;
  signedUrl: string;
};

const FAV_KEY = "pixel-vault-favourites";
const THEME_KEY = "pixel-vault-theme";
const LANG_KEY = "pixel-vault-lang";
const VOTER_KEY = "pixel-vault-voter";

function getVoterKey(): string {
  let v = localStorage.getItem(VOTER_KEY);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, v);
  }
  return v;
}

function Stars({
  value,
  onRate,
  label,
  size = "sm",
}: {
  value: number;
  onRate?: (n: number) => void;
  label: (n: number) => string;
  size?: "sm" | "lg";
}) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(n)}
          title={label(n)}
          aria-label={label(n)}
          className={`${size === "lg" ? "text-2xl" : "text-base"} leading-none transition ${
            n <= value ? "text-gold" : "text-muted-foreground/50"
          } ${onRate ? "hover:scale-125 hover:text-gold" : ""}`}
        >
          {n <= value ? "\u2605" : "\u2606"}
        </button>
      ))}
    </div>
  );
}

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
  const [description, setDescription] = useState("");
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [fileKey, setFileKey] = useState(0);
  const [stage, setStage] = useState<"compress" | "analyze" | "upload">("upload");
  const [category, setCategory] = useState<Category | "All">("All");
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [orientation, setOrientation] = useState<"All" | "landscape" | "portrait">("All");
  const [ratios, setRatios] = useState<Record<string, "landscape" | "portrait">>({});
  const [thanks, setThanks] = useState(false);

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

  const loadRatings = useCallback(async () => {
    const { data } = await supabase.from("photo_ratings").select("photo_id, voter_key, stars");
    const agg: Record<string, { sum: number; count: number }> = {};
    const mine: Record<string, number> = {};
    const me = getVoterKey();
    for (const r of data ?? []) {
      const id = r.photo_id as string;
      const stars = r.stars as number;
      agg[id] = { sum: (agg[id]?.sum ?? 0) + stars, count: (agg[id]?.count ?? 0) + 1 };
      if (r.voter_key === me) mine[id] = stars;
    }
    setRatings(
      Object.fromEntries(
        Object.entries(agg).map(([id, a]) => [id, { avg: a.sum / a.count, count: a.count }]),
      ),
    );
    setMyRatings(mine);
  }, []);

  const ratePhoto = useCallback(
    async (photoId: string, stars: number) => {
      const { error } = await supabase
        .from("photo_ratings")
        .upsert(
          { photo_id: photoId, voter_key: getVoterKey(), stars },
          { onConflict: "photo_id,voter_key" },
        );
      if (error) return notify(dictionaries[lang].ratingFailed(error.message), true);
      notify(dictionaries[lang].ratingSaved);
      await loadRatings();
    },
    [notify, lang, loadRatings],
  );

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos_public")
      .select("id, uploader_name, storage_path, file_name, category, description, created_at")
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
        category: ((r.category as string | null) ?? "").trim() || "Other",
        description: (r.description as string | null) ?? "",
        created_at: r.created_at as string,
        signedUrl: urls[r.storage_path as string] ?? "",
      })),
    );
    setLoading(false);
    void loadRatings();
  }, [notify, lang]);

  useEffect(() => {
    let cancelled = false;
    for (const p of photos) {
      if (!p.signedUrl || ratios[p.id]) continue;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setRatios((r) => ({
          ...r,
          [p.id]: img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait",
        }));
      };
      img.src = p.signedUrl;
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

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
        const res = (await categorizePhoto({ data: { dataUrl: thumb } })) as
          | { category?: string; result?: { category?: string } }
          | undefined;
        const raw = (res?.category ?? res?.result?.category ?? "").trim();
        if (raw) detected = raw;
      } catch (aiErr) {
        console.error("[categorize] failed", aiErr);
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
        description: description.trim(),
      });
      if (dbErr) {
        await supabase.storage.from("photos").remove([path]);
        throw dbErr;
      }

      setName("");
      setPin("");
      setDescription("");
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
      setThanks(true);
      setTimeout(() => setThanks(false), 2600);
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
      if (orientation !== "All" && ratios[p.id] !== orientation) return false;
      if (!term) return true;
      return `${p.uploader_name} ${p.file_name} ${p.description}`.toLowerCase().includes(term);
    });
  }, [photos, search, favOnly, favourites, category, orientation, ratios]);

  const usedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of photos) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [photos]);

  const categoryNames = useMemo(() => usedCategories.map(([c]) => c), [usedCategories]);

  useEffect(() => {
    if (category !== "All" && !categoryNames.includes(category)) setCategory("All");
  }, [categoryNames, category]);

  return (
    <main className="app-backdrop min-h-screen" dir={rtl ? "rtl" : "ltr"}>
      <div className="fx-ambient" aria-hidden="true">
        <div className="fx-gradient" />
        <div className="fx-blob fx-blob-1" />
        <div className="fx-blob fx-blob-2" />
        <div className="fx-blob fx-blob-3" />
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

            <div className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
              <label
                htmlFor="description"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                {t.description}
              </label>
              <input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={160}
                placeholder={t.descriptionPlaceholder}
                className="rounded-xl border border-border bg-input px-3.5 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
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

        <div className="mb-4 flex flex-wrap gap-2">
          {([["All", photos.length], ...usedCategories] as [string, number][]).map(([c, n]) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c as Category | "All")}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                category === c
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border bg-input text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {c === "All" ? t.allCategories : categoryLabel(lang, c)}
              {category === c && (
                <span
                  className="rounded-full bg-background/25 px-2 py-0.5 text-[11px] font-bold"
                  title={`${n} ${t.photosCount}`}
                >
                  {n}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {t.orientation}
          </span>
          {(
            [
              ["All", t.allCategories, "▦"],
              ["landscape", t.landscape, "▭"],
              ["portrait", t.portrait, "▯"],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setOrientation(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                orientation === key
                  ? "border-transparent bg-gold text-background"
                  : "border-border bg-input text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {icon} {label}
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
                    {categoryLabel(lang, p.category)}
                  </span>
                  <span className="absolute inset-0 grid place-items-center bg-background/55 text-sm font-semibold opacity-0 backdrop-blur-[2px] transition group-hover:opacity-100">
                    🔎 {t.viewPhoto}
                  </span>
                </button>
                <div className="space-y-2 p-3">
                  <p className={`line-clamp-2 text-xs ${p.description ? "text-foreground/80" : "text-muted-foreground/70 italic"}`}>
                    {p.description || t.noDescription}
                  </p>
                  <div className="flex items-center gap-2">
                    <Stars
                      value={myRatings[p.id] ?? Math.round(ratings[p.id]?.avg ?? 0)}
                      onRate={(n) => void ratePhoto(p.id, n)}
                      label={t.rateStars}
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {ratings[p.id]
                        ? `${ratings[p.id]!.avg.toFixed(1)} (${ratings[p.id]!.count})`
                        : t.noRatings}
                    </span>
                  </div>
                <div className="flex items-center justify-between gap-2">
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
                  {lightbox.file_name} · {categoryLabel(lang, lightbox.category)} ·{" "}
                  {new Date(lightbox.created_at).toLocaleDateString(
                    lang === "bn" ? "bn-BD" : lang === "ar" ? "ar-EG" : "en-US",
                  )}
                </p>
                <p className="mt-1 text-sm">
                  {lightbox.description || (
                    <span className="italic text-muted-foreground">{t.noDescription}</span>
                  )}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Stars
                    size="lg"
                    value={myRatings[lightbox.id] ?? Math.round(ratings[lightbox.id]?.avg ?? 0)}
                    onRate={(n) => void ratePhoto(lightbox.id, n)}
                    label={t.rateStars}
                  />
                  <span className="text-xs text-muted-foreground">
                    {ratings[lightbox.id]
                      ? `${ratings[lightbox.id]!.avg.toFixed(1)} (${ratings[lightbox.id]!.count})`
                      : t.noRatings}
                  </span>
                </div>
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

      {thanks && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-6 z-[60] grid place-items-center px-4"
        >
          <div className="thanks-pop flex items-center gap-3 rounded-2xl border border-gold/60 bg-card/95 px-6 py-4 shadow-2xl backdrop-blur">
            <span className="thanks-emoji text-2xl">🎉</span>
            <div>
              <p className="font-display text-base font-bold text-gradient">{t.thanksTitle}</p>
              <p className="text-xs text-muted-foreground">{t.thanksBody}</p>
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
