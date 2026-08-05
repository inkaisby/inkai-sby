import { z } from "zod";

const uiPartSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
  })
  .passthrough();

const uiMessageSchema = z.object({
  id: z.string().min(1).max(128),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(uiPartSchema).min(1).max(32),
});

export const tanyaInkaiBodySchema = z.object({
  id: z.string().max(128).optional(),
  messages: z.array(uiMessageSchema).min(1).max(24),
});

export const MAX_USER_TEXT_CHARS = 2_000;

export function extractLastUserText(
  messages: z.infer<typeof tanyaInkaiBodySchema>["messages"],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "user") continue;
    const text = msg.parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text!)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}
