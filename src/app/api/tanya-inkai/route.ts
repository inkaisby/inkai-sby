import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { mapTanyaInkaiError } from "@/lib/tanya-inkai/errors";
import { buildTanyaInkaiSystemPrompt } from "@/lib/tanya-inkai/knowledge";
import { answerTanyaInkaiLocal } from "@/lib/tanya-inkai/local-answer";
import {
  createMixrouteProvider,
  getTanyaInkaiModelId,
  hasMixrouteApiKey,
} from "@/lib/tanya-inkai/mixroute";
import {
  extractLastUserText,
  MAX_USER_TEXT_CHARS,
  tanyaInkaiBodySchema,
} from "@/lib/tanya-inkai/schema";
import { streamLocalTextResponse } from "@/lib/tanya-inkai/stream-local";
import { rateLimitAsync, rateLimitResponse } from "@/lib/security/rate-limit";
import {
  assertJsonRequest,
  assertSameOriginLoose,
  getClientIp,
} from "@/lib/security/request";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!assertSameOriginLoose(request)) {
      return NextResponse.json({ error: "Origin tidak valid." }, { status: 403 });
    }
    if (!assertJsonRequest(request)) {
      return NextResponse.json(
        { error: "Content-Type harus application/json." },
        { status: 415 },
      );
    }

    const ip = getClientIp(request);
    const session = await auth();
    const userKey = session?.user?.id ? `u:${session.user.id}` : `ip:${ip}`;
    const rlKey = `tanya-inkai:${userKey}`;
    const limited = await rateLimitAsync(rlKey, { max: 20, windowMs: 60_000 });
    if (!limited.success) {
      return rateLimitResponse(limited.retryAfterSec ?? 60, rlKey);
    }

    const raw = await request.json();
    const parsed = tanyaInkaiBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }

    const lastUserText = extractLastUserText(parsed.data.messages);
    if (!lastUserText) {
      return NextResponse.json(
        { error: "Pesan pengguna kosong." },
        { status: 400 },
      );
    }
    if (lastUserText.length > MAX_USER_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Pesan terlalu panjang (maks ${MAX_USER_TEXT_CHARS} karakter).` },
        { status: 400 },
      );
    }

    // Tanpa MixRoute: tetap jawab dari knowledge lokal (seperti asisten offline)
    if (!hasMixrouteApiKey()) {
      const local = answerTanyaInkaiLocal(lastUserText);
      return streamLocalTextResponse(local);
    }

    const messages = parsed.data.messages as UIMessage[];
    const mixroute = createMixrouteProvider();

    const result = streamText({
      model: mixroute(getTanyaInkaiModelId()),
      system: buildTanyaInkaiSystemPrompt(),
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 1_024,
      temperature: 0.4,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        onError: (error) => {
          console.error("[tanya-inkai] stream", error);
          return mapTanyaInkaiError(error);
        },
      }),
    });
  } catch (error) {
    console.error("[tanya-inkai]", error);
    return NextResponse.json(
      { error: mapTanyaInkaiError(error) },
      { status: 500 },
    );
  }
}
