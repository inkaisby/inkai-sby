"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ArticleMediaItem } from "@/lib/articles";
import { youtubeEmbedSrc, youtubeThumbUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

function ImageThumb({
  item,
  onOpen,
}: {
  item: ArticleMediaItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/60 transition-opacity hover:opacity-95"
      aria-label={item.caption ? `Lihat foto: ${item.caption}` : "Lihat foto"}
    >
      <Image
        src={item.url}
        alt={item.caption || "Foto artikel"}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 50vw"
        unoptimized
      />
      {item.caption ? (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-xs text-white">
          {item.caption}
        </span>
      ) : null}
    </button>
  );
}

function VideoPlayer({
  item,
  playing,
  onPlay,
}: {
  item: ArticleMediaItem;
  playing: boolean;
  onPlay: () => void;
}) {
  const embed = youtubeEmbedSrc(item.url);
  const thumb = youtubeThumbUrl(item.url);

  if (!embed) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
        Video tidak valid
      </div>
    );
  }

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`${embed}?autoplay=1`}
          title={item.caption || "Video artikel"}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-border/60"
      aria-label={item.caption ? `Putar video: ${item.caption}` : "Putar video"}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={item.caption || "Thumbnail video"}
          className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        />
      ) : (
        <span className="absolute inset-0 bg-gradient-to-br from-inkai-red/40 to-inkai-yellow/30" />
      )}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-inkai-red/95 text-white shadow-lg transition-transform group-hover:scale-105">
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      </span>
      {item.caption ? (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-xs text-white">
          {item.caption}
        </span>
      ) : null}
    </button>
  );
}

export function ArticleMediaGallery({
  media,
  className,
}: {
  media: ArticleMediaItem[];
  className?: string;
}) {
  const images = media.filter((m) => m.type === "IMAGE");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null);
  const open = lightboxIndex != null;
  const current =
    lightboxIndex != null && images[lightboxIndex]
      ? images[lightboxIndex]
      : null;

  if (media.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "grid gap-3",
          media.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        {media.map((item, idx) => {
          const key = `${item.type}-${idx}-${item.url}`;
          if (item.type === "VIDEO") {
            return (
              <VideoPlayer
                key={key}
                item={item}
                playing={activeVideoKey === key}
                onPlay={() => setActiveVideoKey(key)}
              />
            );
          }
          let resolvedIndex = -1;
          let imageCursor = -1;
          for (let i = 0; i < media.length; i += 1) {
            if (media[i].type !== "IMAGE") continue;
            imageCursor += 1;
            if (i === idx) {
              resolvedIndex = imageCursor;
              break;
            }
          }
          return (
            <ImageThumb
              key={key}
              item={item}
              onOpen={() => setLightboxIndex(Math.max(0, resolvedIndex))}
            />
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setLightboxIndex(null);
        }}
      >
        <DialogContent
          className="max-w-[min(96vw,56rem)] gap-3 border-0 bg-black/95 p-3 text-white sm:max-w-[min(96vw,56rem)]"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{current?.caption || "Foto artikel"}</DialogTitle>
          </DialogHeader>
          {current ? (
            <>
              <div className="relative mx-auto aspect-video w-full max-h-[78vh] overflow-hidden rounded-lg">
                <Image
                  src={current.url}
                  alt={current.caption || "Foto artikel"}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 96vw, 56rem"
                  unoptimized
                  priority
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  disabled={lightboxIndex === 0}
                  onClick={() =>
                    setLightboxIndex((i) =>
                      i != null && i > 0 ? i - 1 : i,
                    )
                  }
                  aria-label="Foto sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-sm text-white/80">
                  {current.caption ||
                    `${(lightboxIndex ?? 0) + 1} / ${images.length}`}
                </p>
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                  disabled={
                    lightboxIndex == null ||
                    lightboxIndex >= images.length - 1
                  }
                  onClick={() =>
                    setLightboxIndex((i) =>
                      i != null && i < images.length - 1 ? i + 1 : i,
                    )
                  }
                  aria-label="Foto berikutnya"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Thumbnail di daftar: klik membuka lightbox jika ada foto, bukan navigasi. */
export function ArticlePhotoLightbox({
  title,
  photoUrl,
  className,
}: {
  title: string;
  photoUrl: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!photoUrl) {
    return (
      <div
        className={cn(
          "flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-inkai-red/10 to-inkai-yellow/10 text-2xl font-semibold text-inkai-red/70 sm:w-44",
          className,
        )}
        aria-hidden
      >
        {title.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "relative block aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-muted/40 transition-opacity hover:opacity-90 sm:w-44",
          className,
        )}
        aria-label={`Lihat foto ${title}`}
      >
        <Image
          src={photoUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="176px"
          unoptimized
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[min(92vw,40rem)] gap-3 border-0 bg-black/95 p-3 text-white sm:max-w-[min(92vw,40rem)]"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="relative mx-auto aspect-video w-full max-h-[75vh] overflow-hidden rounded-lg">
            <Image
              src={photoUrl}
              alt={title}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 92vw, 40rem"
              unoptimized
              priority
            />
          </div>
          <p className="truncate text-center text-sm text-white/80">{title}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
