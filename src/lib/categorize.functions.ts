import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { detectCategory, hashtagCategory, matchExisting } from "./categorize.server";

export const categorizePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        dataUrl: z.string().min(16),
        title: z.string().max(300).optional(),
        existing: z.array(z.string()).max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const existing = (data.existing ?? []).filter(Boolean);

    // Priority 1: capitalized hashtag in the photo title / file name.
    const tag = hashtagCategory(data.title ?? "");
    if (tag) {
      return { category: matchExisting(tag, existing) ?? tag, source: "hashtag" as const };
    }

    // Priority 2: AI vision, preferring an existing category.
    const category = await detectCategory(data.dataUrl, existing);
    return {
      category: matchExisting(category, existing) ?? category,
      source: "vision" as const,
    };
  });
