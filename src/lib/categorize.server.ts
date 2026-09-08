import { CATEGORIES, type Category } from "./i18n";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function titleCase(raw: string, maxWords = 2): string {
  return raw
    .split(/\s+/)
    .slice(0, maxWords)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 24);
}

/** Priority 1: pull a CAPITALIZED hashtag (e.g. "#LANDSCAPE") out of a title/file name. */
export function hashtagCategory(title: string): string | null {
  const m = title.match(/#([\p{Lu}][\p{Lu}\p{N}_-]{1,23})\b/u);
  if (!m?.[1]) return null;
  const words = m[1].replace(/[_-]+/g, " ").trim();

  if (!words) return null;
  return titleCase(words, 3);
}

/** Case/spacing-insensitive match against categories already present in the gallery. */
export function matchExisting(candidate: string, existing: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");
  const c = norm(candidate);
  if (!c) return null;
  return existing.find((e) => norm(e) === c) ?? null;
}

export async function detectCategory(
  dataUrl: string,
  existing: string[] = [],
): Promise<Category> {

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return "Other";

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        {
          role: "system",
          content: `You are a precise image classifier. Identify the main subject of the photo and answer with ONE short, highly relevant English category label in Title Case (one or two words max).
Prefer one of these standard categories when the photo clearly fits: ${CATEGORIES.filter((c) => c !== "Other").join(", ")}.
Prefer a more specific sub-category when the subject is clearly a recognisable kind, e.g. Sports Cars, Fighter Jets, Wild Animals, Street Food, Mountains, Beaches, Night Sky, Skyscrapers, Portraits, Pets, Desserts, Motorbikes, Boats, Flowers.
If nothing fits, invent a concise, generic new category of your own.
Answer with the label only, no punctuation, no explanation.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Which category is this photo?" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      // The model spends tokens on internal reasoning first; a small cap
      // truncates the answer and returns empty content.
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    console.error("[categorize] gateway error", res.status, await res.text());
    return "Other";
  }

  const json = (await res.json()) as {
    choices?: {
      message?: { content?: string | { type?: string; text?: string }[] };
    }[];
  };
  const content = json.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((c) => c?.text ?? "")
            .join(" ")
        : "";
  const raw = text
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim();
  if (!raw) return "Other";

  // Exact match to a standard category wins; multi-word answers stay as sub-categories.
  const known = CATEGORIES.find((c) => raw.toLowerCase() === c.toLowerCase());
  if (known) return known;
  if (/\s/.test(raw)) {
    return raw
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
      .slice(0, 24);
  }

  const alias: Record<string, string> = {
    aviation: "Planes",
    airplane: "Planes",
    aeroplane: "Planes",
    plane: "Planes",
    aircraft: "Planes",
    jet: "Planes",
    car: "Cars",
    vehicle: "Cars",
    automobile: "Cars",
    animal: "Animals",
    pet: "Animals",
    person: "People",
    portrait: "People",
    building: "Architecture",
    technology: "Tech",
    gadget: "Tech",
    computer: "Tech",
    sport: "Sports",
    landscape: "Nature",
  };
  const lower = raw.toLowerCase();
  for (const [k, v] of Object.entries(alias)) {
    if (lower.includes(k)) return v;
  }

  const label = raw
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .slice(0, 24);
  return label || "Other";
}
