import { createFileRoute } from "@tanstack/react-router";

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

function Index() {
  return (
    <main className="h-screen w-screen">
      <h1 className="sr-only">Pixel Vault shared photo gallery</h1>
      <iframe
        src="/gallery.html"
        title="Pixel Vault photo gallery"
        className="h-full w-full border-0"
      />
    </main>
  );
}
