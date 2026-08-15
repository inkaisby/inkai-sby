"use client";

import { useEffect, useState, useTransition } from "react";
import { showError } from "@/lib/client-toast";
import {
  ARTICLE_REACTION_EMOJIS,
  emptyReactionCounts,
  type ArticleReactionCounts,
  type ArticleReactionEmoji,
} from "@/lib/article-reactions";
import { cn } from "@/lib/utils";

const EMOJI_LABELS: Record<ArticleReactionEmoji, string> = {
  "👍": "Jempol",
  "❤️": "Suka",
  "🔥": "Keren",
  "🙏": "Terima kasih",
  "😮": "Kaget",
};

type Props = {
  articleId: string;
  initialCounts?: ArticleReactionCounts;
  className?: string;
  compact?: boolean;
};

export function ArticleReactions({
  articleId,
  initialCounts,
  className,
  compact = false,
}: Props) {
  const [counts, setCounts] = useState<ArticleReactionCounts>(
    initialCounts ?? emptyReactionCounts(),
  );
  const [mine, setMine] = useState<ArticleReactionEmoji | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/public/artikel/${articleId}/reactions`, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          counts?: ArticleReactionCounts;
          mine?: ArticleReactionEmoji | null;
        };
        if (cancelled) return;
        if (data.counts) setCounts({ ...emptyReactionCounts(), ...data.counts });
        setMine(data.mine ?? null);
      } catch {
        /* ignore hydrate errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  function react(emoji: ArticleReactionEmoji) {
    if (pending) return;

    const prevCounts = counts;
    const prevMine = mine;

    const next = { ...counts };
    if (prevMine === emoji) {
      next[emoji] = Math.max(0, next[emoji] - 1);
      setMine(null);
    } else {
      if (prevMine) next[prevMine] = Math.max(0, next[prevMine] - 1);
      next[emoji] = (next[emoji] ?? 0) + 1;
      setMine(emoji);
    }
    setCounts(next);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/public/artikel/${articleId}/reactions`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCounts(prevCounts);
          setMine(prevMine);
          showError(
            typeof data.error === "string"
              ? data.error
              : "Gagal menyimpan reaksi",
          );
          return;
        }
        if (data.counts) {
          setCounts({ ...emptyReactionCounts(), ...data.counts });
        }
        setMine(data.mine ?? null);
      } catch {
        setCounts(prevCounts);
        setMine(prevMine);
        showError("Gagal menyimpan reaksi");
      }
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        compact ? "mt-3" : "mt-4",
        className,
      )}
      role="group"
      aria-label="Reaksi pembaca"
    >
      {ARTICLE_REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const selected = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            disabled={pending}
            onClick={() => react(emoji)}
            aria-label={`Reaksi ${EMOJI_LABELS[emoji]}${count ? `, ${count}` : ""}`}
            aria-pressed={selected}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
              selected
                ? "border-inkai-red/40 bg-inkai-red/10 text-foreground"
                : "border-border/70 bg-background/80 text-muted-foreground hover:border-inkai-red/30 hover:bg-muted/40",
              pending && "opacity-70",
            )}
          >
            <span aria-hidden className="text-base leading-none">
              {emoji}
            </span>
            {count > 0 ? (
              <span className="min-w-[1ch] text-xs font-medium tabular-nums">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
