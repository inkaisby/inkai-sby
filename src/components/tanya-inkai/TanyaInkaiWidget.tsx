"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, SendHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { SITE_CONTACT } from "@/lib/site";
import { toWhatsAppLink } from "@/lib/phone";
import { cn } from "@/lib/utils";
import {
  hasOpenedTanyaInkai,
  markOpenedTanyaInkai,
  useDraggableFab,
} from "./useDraggableFab";

const PANEL_W = 360;
const PANEL_H = 480;

function messageText(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text!)
    .join("");
}

export function TanyaInkaiWidget() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/undangan")) return null;
  return <TanyaInkaiWidgetInner pathname={pathname} />;
}

function TanyaInkaiWidgetInner({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pulse, setPulse] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const {
    pos,
    ready,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useDraggableFab(pathname);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/tanya-inkai" }),
    [],
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const waitingFirstToken =
    busy &&
    (messages.length === 0 ||
      messages[messages.length - 1]?.role === "user" ||
      (messages[messages.length - 1]?.role === "assistant" &&
        !messageText(messages[messages.length - 1].parts as { type: string; text?: string }[])));

  const waLink = toWhatsAppLink(SITE_CONTACT.whatsapp);

  useEffect(() => {
    if (hasOpenedTanyaInkai()) return;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 4200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setPanelVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, waitingFirstToken, open]);

  const panelStyle = useMemo(() => {
    if (typeof window === "undefined") {
      return { left: pos.x, top: pos.y - PANEL_H - 12 };
    }
    const margin = 8;
    let left = pos.x + 56 - PANEL_W;
    let top = pos.y - PANEL_H - 12;
    left = Math.min(Math.max(margin, left), window.innerWidth - PANEL_W - margin);
    if (top < margin) {
      top = Math.min(pos.y + 64, window.innerHeight - PANEL_H - margin);
    }
    top = Math.min(Math.max(margin, top), window.innerHeight - PANEL_H - margin);
    return { left, top };
  }, [pos.x, pos.y, open]);

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        markOpenedTanyaInkai();
        setPulse(false);
      }
      return next;
    });
  }, []);

  const handleFabPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const wasDrag = onPointerUp(e);
      if (!wasDrag) {
        toggleOpen();
      }
    },
    [onPointerUp, toggleOpen],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError?.();
    void sendMessage({ text });
    setInput("");
  };

  if (!ready) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {open ? (
        <div
          className={cn(
            "pointer-events-auto fixed flex max-h-[min(480px,calc(100vh-24px))] w-[min(360px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-black/15",
            "tanya-inkai-panel",
            panelVisible ? "tanya-inkai-panel-open" : "tanya-inkai-panel-closed",
          )}
          style={panelStyle}
          role="dialog"
          aria-label="Tanya INKAI"
        >
          <header className="flex items-start justify-between gap-2 border-b border-border/60 bg-inkai-red px-3 py-2.5 text-white">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-wide">Tanya INKAI</p>
              <p className="text-[11px] text-white/85">
                Asisten portal INKAI Surabaya
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/90 hover:bg-white/15"
              aria-label="Tutup chat"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
          >
            {messages.length === 0 ? (
              <div className="tanya-inkai-msg rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                Halo! Tanya seputar INKAI Surabaya atau cara pakai website ini
                (daftar, iuran, UKT, dojo, absensi). Pertanyaan di luar topik
                akan saya arahkan kembali.
              </div>
            ) : null}

            {messages.map((message) => {
              const text = messageText(
                message.parts as { type: string; text?: string }[],
              );
              if (!text && message.role === "assistant") return null;
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={cn(
                    "tanya-inkai-msg max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isUser
                      ? "ml-auto bg-inkai-red text-white"
                      : "mr-auto bg-muted text-foreground",
                  )}
                >
                  {text}
                </div>
              );
            })}

            {waitingFirstToken ? (
              <div
                className="tanya-inkai-msg mr-auto flex items-center gap-1 rounded-2xl bg-muted px-3 py-2"
                aria-label="Sedang mengetik"
              >
                <span className="tanya-inkai-dot" />
                <span className="tanya-inkai-dot" />
                <span className="tanya-inkai-dot" />
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error.message || "Gagal mengirim. Coba lagi."}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 px-3 py-2">
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block text-[11px] font-medium text-inkai-red hover:underline"
            >
              Chat WhatsApp sekretariat
            </a>
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={1}
                maxLength={2000}
                placeholder="Tulis pertanyaan…"
                className="max-h-24 min-h-9 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inkai-red/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-inkai-red text-white disabled:opacity-50"
                aria-label="Kirim"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "pointer-events-auto fixed flex h-14 w-14 touch-none items-center justify-center rounded-full bg-inkai-red text-white shadow-lg shadow-inkai-red/35 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-inkai-red/40",
          "tanya-inkai-fab",
          pulse && !open ? "tanya-inkai-fab-pulse" : null,
          dragging ? "cursor-grabbing scale-105" : "cursor-grab",
        )}
        style={{ left: pos.x, top: pos.y }}
        aria-label={open ? "Tutup Tanya INKAI" : "Buka Tanya INKAI"}
        aria-expanded={open}
        title="Tanya INKAI"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerUp}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
        <span className="sr-only">Tanya INKAI</span>
      </button>
    </div>
  );
}
