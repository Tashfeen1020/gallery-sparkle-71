import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { detectCategory } from "./categorize.server";

export const categorizePhoto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ dataUrl: z.string().min(16) }).parse(data),
  )
  .handler(async ({ data }) => {
    const category = await detectCategory(data.dataUrl);
    return { category };
  });
