"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Send } from "lucide-react";

type ConvListItem = {
  id: string;
  lastMessageAt: string;
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

export function AdminPesanClient() {
  const [list, setList] = useState<ConvListItem[]>([]);
  const [meId, setMeId] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function loadList() {
    setLoading(true);
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
      setLoading(false);
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
  }

  useEffect(() => {
    void loadList();
  }, []);

  async function send() {
    if (!activeId || !text.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/pesan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeId, content: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim");
        return;
      }
      setText("");
      showSuccess("Terkirim");
      await openConv(activeId);
      await loadList();
    } finally {
      setSending(false);
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

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border">
        <div className="border-b p-3 text-sm font-semibold">Kotak Masuk</div>
        {loading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Belum ada pesan.</p>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => void openConv(c.id)}
                className={`block w-full border-b p-3 text-left hover:bg-muted/50 ${
                  activeId === c.id ? "bg-muted" : ""
                }`}
              >
                <p className="truncate text-sm font-medium">{label(c)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.messages[0]?.content || "—"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-[420px] flex-col rounded-xl border">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            Pilih percakapan
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        mine ? "bg-inkai-red text-white" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 border-t p-3">
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
                className="bg-inkai-red hover:bg-inkai-red/90"
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
  );
}
