"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";
import { ArrowLeft, Loader2, Megaphone, Search, Send } from "lucide-react";

type ConvListItem = {
  id: string;
  lastMessageAt: string;
  unreadCount?: number;
  participants: Array<{
    id: string;
    fullName: string | null;
    email: string;
    member?: { fullName: string; nia: string | null } | null;
  }>;
  messages: Array<{ content: string; createdAt: string }>;
};

type Message = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { fullName: string | null };
};

type DojoOpt = { id: string; name: string };

export function AdminPesanClient({ dojos = [] }: { dojos?: DojoOpt[] }) {
  const [list, setList] = useState<ConvListItem[]>([]);
  const [meId, setMeId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bcTitle, setBcTitle] = useState("");
  const [bcContent, setBcContent] = useState("");
  const [bcScope, setBcScope] = useState<"all" | "dojo">("all");
  const [bcDojoId, setBcDojoId] = useState(dojos[0]?.id ?? "");
  const [broadcasting, setBroadcasting] = useState(false);

  async function loadList(opts?: { soft?: boolean }) {
    if (!opts?.soft) setLoading(true);
    try {
      const res = await fetch("/api/admin/pesan");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat");
        return;
      }
      setList(data.data ?? []);
      setMeId(data.meId || "");
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }

  async function openConv(id: string) {
    setActiveId(id);
    const res = await fetch(`/api/admin/pesan/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || "Gagal memuat percakapan");
      return;
    }
    setMessages(data.conversation?.messages ?? []);
    setMeId(data.meId || meId);
    setList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }

  useEffect(() => {
    void loadList();
  }, []);

  async function send() {
    if (!activeId || !text.trim()) return;
    const content = text.trim();
    setSending(true);
    try {
      const res = await fetch("/api/admin/pesan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim");
        return;
      }
      setText("");
      const sent: Message = {
        id: String(data.message?.id ?? data.data?.id ?? `tmp-${Date.now()}`),
        content,
        createdAt: new Date().toISOString(),
        senderId: meId,
        sender: { fullName: null },
      };
      setMessages((prev) => [...prev, sent]);
      setList((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                lastMessageAt: sent.createdAt,
                messages: [{ content, createdAt: sent.createdAt }],
              }
            : c,
        ),
      );
      showSuccess("Terkirim");
      void loadList({ soft: true });
    } finally {
      setSending(false);
    }
  }

  async function sendBroadcast() {
    if (!bcTitle.trim() || !bcContent.trim()) return;
    if (bcScope === "dojo" && !bcDojoId) {
      showError("Pilih ranting");
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bcTitle.trim(),
          content: bcContent.trim(),
          scope: bcScope,
          ...(bcScope === "dojo" ? { dojoId: bcDojoId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal broadcast");
        return;
      }
      showSuccess(data.message || "Broadcast terkirim");
      setBcTitle("");
      setBcContent("");
      setShowBroadcast(false);
    } finally {
      setBroadcasting(false);
    }
  }

  function label(c: ConvListItem) {
    const other = c.participants.find((p) => p.id !== meId) || c.participants[0];
    return (
      other?.member?.fullName ||
      other?.fullName ||
      other?.email ||
      "Percakapan"
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const name = label(c).toLowerCase();
      const preview = (c.messages[0]?.content || "").toLowerCase();
      const emails = c.participants.map((p) => p.email.toLowerCase()).join(" ");
      return name.includes(q) || preview.includes(q) || emails.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- label uses meId/list
  }, [list, query, meId]);

  const activeConv = activeId != null ? list.find((c) => c.id === activeId) : undefined;
  const activeLabel = activeConv ? label(activeConv) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-1.5 sm:h-8 sm:w-auto"
          onClick={() => setShowBroadcast((v) => !v)}
        >
          <Megaphone className="h-3.5 w-3.5" />
          Broadcast notifikasi
        </Button>
        <p className="text-xs text-muted-foreground">
          Broadcast mengirim notifikasi (bukan chat) ke anggota aktif di scope Anda.
        </p>
      </div>

      {showBroadcast ? (
        <div className="space-y-3 rounded-xl border p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Broadcast ke anggota</h3>
          <input
            value={bcTitle}
            onChange={(e) => setBcTitle(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm"
            placeholder="Judul notifikasi"
            maxLength={120}
          />
          <textarea
            value={bcContent}
            onChange={(e) => setBcContent(e.target.value)}
            className="min-h-[88px] w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Isi pengumuman..."
            maxLength={2000}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={bcScope === "all"}
                onChange={() => setBcScope("all")}
              />
              Semua di scope
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={bcScope === "dojo"}
                onChange={() => setBcScope("dojo")}
                disabled={dojos.length === 0}
              />
              Satu ranting
            </label>
            {bcScope === "dojo" ? (
              <select
                value={bcDojoId}
                onChange={(e) => setBcDojoId(e.target.value)}
                className="h-10 w-full rounded-lg border px-2 text-sm sm:h-9 sm:w-auto"
              >
                {dojos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              type="button"
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={broadcasting || !bcTitle.trim() || !bcContent.trim()}
              onClick={() => void sendBroadcast()}
            >
              {broadcasting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Kirim broadcast"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowBroadcast(false)}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Inbox — di HP sembunyi saat thread terbuka */}
        <div
          className={`rounded-xl border ${
            activeId ? "hidden lg:block" : "block"
          }`}
        >
          <div className="space-y-2 border-b p-3">
            <p className="text-sm font-semibold">Kotak Masuk</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-lg border pl-8 pr-3 text-sm sm:h-9"
                placeholder="Cari nama / isi..."
              />
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {list.length === 0 ? "Belum ada pesan." : "Tidak ada hasil pencarian."}
            </p>
          ) : (
            <div className="max-h-[min(70vh,520px)] overflow-y-auto">
              {filtered.map((c) => {
                const unread = c.unreadCount ?? 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void openConv(c.id)}
                    className={`block w-full border-b p-3 text-left hover:bg-muted/50 ${
                      activeId === c.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`truncate text-sm ${
                          unread > 0 ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {label(c)}
                      </p>
                      {unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-inkai-red px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.messages[0]?.content || "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread — di HP full-pane saat terbuka */}
        <div
          className={`flex min-h-[min(70vh,420px)] flex-col rounded-xl border lg:min-h-[420px] ${
            activeId ? "block" : "hidden lg:flex"
          }`}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Pilih percakapan
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b px-2 py-2 sm:px-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 lg:hidden"
                  onClick={() => setActiveId(null)}
                  aria-label="Kembali ke kotak masuk"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <p className="min-w-0 truncate text-sm font-semibold">{activeLabel}</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
                {messages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%] ${
                          mine ? "bg-inkai-red text-white" : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="h-10 flex-1 rounded-lg border px-3 text-sm"
                  placeholder="Balas pesan..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  className="h-10 shrink-0 bg-inkai-red hover:bg-inkai-red/90"
                  disabled={sending || !text.trim()}
                  onClick={() => void send()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
