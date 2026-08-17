import { CATEGORIES, type Category } from "./i18n";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export async function detectCategory(dataUrl: string): Promise<Category> {
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
          content: `You are an image classifier. Identify the main subject of the photo and answer with ONE short English category label in Title Case (one or two words max).
Prefer one of these when it fits: ${CATEGORIES.filter((c) => c !== "Other").join(", ")}.
If none fits, invent a concise, generic category (e.g. Boats, Flowers, Space, Fashion, Music, Interiors).
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
      max_tokens: 64,
    }),
  });

  if (!res.ok) {
    console.error("[categorize] gateway error", res.status, await res.text());
    return "Other";
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = (json.choices?.[0]?.message?.content ?? "")
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim();
  if (!raw) return "Other";

  const known = CATEGORIES.find((c) => raw.toLowerCase().includes(c.toLowerCase()));
  if (known) return known;

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
