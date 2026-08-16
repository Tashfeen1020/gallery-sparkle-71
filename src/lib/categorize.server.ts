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
          content: `Classify the photo into exactly one of these categories: ${CATEGORIES.join(
            ", ",
          )}. Answer with the single category word only, nothing else.`,
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
  const raw = (json.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
  const match = CATEGORIES.find((c) => raw.includes(c.toLowerCase()));
  console.log("[categorize] raw:", raw, "->", match ?? "Other");
  return match ?? "Other";
}
