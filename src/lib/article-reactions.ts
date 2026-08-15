export const ARTICLE_REACTION_EMOJIS = ["👍", "❤️", "🔥", "🙏", "😮"] as const;
export type ArticleReactionEmoji = (typeof ARTICLE_REACTION_EMOJIS)[number];

export const ARTICLE_VISITOR_COOKIE = "inkai_artikel_vid";
export const ARTICLE_VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // 1 tahun

export type ArticleReactionCounts = Record<ArticleReactionEmoji, number>;

export function emptyReactionCounts(): ArticleReactionCounts {
  return {
    "👍": 0,
    "❤️": 0,
    "🔥": 0,
    "🙏": 0,
    "😮": 0,
  };
}

export function isArticleReactionEmoji(
  value: string,
): value is ArticleReactionEmoji {
  return (ARTICLE_REACTION_EMOJIS as readonly string[]).includes(value);
}
