import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  created_at: string;
  signedUrl: string;
};

const FAV_KEY = "pixel-vault-favourites";

function Index() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [favOnly, setFavOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);

  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(FAV_KEY);
    if (stored) setFavourites(JSON.parse(stored) as string[]);
  }, []);

  const loadPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from("photos_public")
      .select("id, uploader_name, storage_path, file_name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      notify(`Could not load gallery: ${error.message}`, true);
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
        created_at: r.created_at as string,
        signedUrl: urls[r.storage_path as string] ?? "",
      })),
    );
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) return notify("PIN must be exactly 4 digits.", true);
    if (!file) return notify("Please choose an image file.", true);
    if (!file.type.startsWith("image/")) return notify("Only image files are allowed.", true);

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]/g, "_");
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("photos").insert({
        uploader_name: name.trim() || "Anonymous",
        pin_hash: pin,
        url: path,
        storage_path: path,
        file_name: file.name,
      });
      if (dbErr) {
        await supabase.storage.from("photos").remove([path]);
        throw dbErr;
      }

      setName("");
      setPin("");
      setFile(null);
      setFileKey((k) => k + 1);
      notify("Photo uploaded!");
      await loadPhotos();
    } catch (err) {
      notify(`Upload failed: ${(err as Error).message}`, true);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: Photo) {
    const entered = window.prompt("Enter the 4-digit PIN used to upload this photo:");
    if (entered === null) return;
    if (!/^\d{4}$/.test(entered.trim())) return notify("PIN must be 4 digits.", true);

    const { data, error } = await supabase.rpc("delete_photo", {
      p_id: photo.id,
      p_pin: entered.trim(),
    });

    if (error) return notify(`Delete failed: ${error.message}`, true);
    if (!data) return notify("Wrong PIN — delete cancelled.", true);

    const { error: rmErr } = await supabase.storage.from("photos").remove([data as string]);
    if (rmErr) notify(`Removed from gallery, file cleanup failed: ${rmErr.message}`, true);
    else notify("Photo deleted.");

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
      notify("Photo saved to your device.");
    } catch (err) {
      notify(`Save failed: ${(err as Error).message}`, true);
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
      if (!term) return true;
      return `${p.uploader_name} ${p.file_name}`.toLowerCase().includes(term);
    });
  }, [photos, search, favOnly, favourites]);

  return (
    <main className="app-backdrop min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8">
        <header className="mb-6">
          <h1 className="text-gradient font-display text-4xl font-bold sm:text-5xl">Pixel Vault</h1>
          <p className="mt-2 text-muted-foreground">
            Upload a photo with your name and a 4-digit PIN. Anyone can view — only the PIN can
            delete.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-xl">
          <form
            onSubmit={handleUpload}
            className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="grid gap-1.5">
              <label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
                Uploader name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                required
                placeholder="Jane Doe"
                className="rounded-xl border border-border bg-input px-3.5 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="file" className="text-xs uppercase tracking-wider text-muted-foreground">
                Photo
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
                Secret PIN
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
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
          </form>
        </section>

        <div className="my-7 flex flex-wrap items-center gap-3">
          <div className="rainbow-ring min-w-[260px] flex-1 rounded-full p-0.5">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm">
                🔍
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by uploader or file name…"
                aria-label="Search photos"
                className="w-full rounded-full bg-input py-3 pl-10 pr-4 text-foreground outline-none"
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
            ★ Favourites only
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-muted-foreground">Loading gallery…</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">
            {photos.length ? "No photos match your filters." : "No photos yet — be the first!"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
              >
                <img
                  src={p.signedUrl}
                  alt={`Photo uploaded by ${p.uploader_name}`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.uploader_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      title="Toggle favourite"
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
                      title="Save photo"
                      aria-label={`Save photo uploaded by ${p.uploader_name}`}
                      onClick={() => void handleSave(p)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-input text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      ⬇
                    </button>
                    <button
                      type="button"
                      title="Delete photo"
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
