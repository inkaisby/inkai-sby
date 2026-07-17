"use client";

import { useEffect, useState } from "react";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Send } from "lucide-react";

type Message = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: { id: string; fullName: string | null };
};

type Conversation = {
  id: string;
  messages: Message[];
};

export function PesanClient() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [meId, setMeId] = useState<string>("");
  const [hint, setHint] = useState<string>("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/member/pesan");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal memuat pesan");
        return;
      }
      setConversation(data.conversation ?? null);
      setMeId(data.meId || "");
      setHint(data.message || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/member/pesan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          conversationId: conversation?.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim");
        return;
      }
      setText("");
      showSuccess("Pesan terkirim");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <MemberPageHeader title="Pesan" />
      <p className="mb-4 text-sm text-muted-foreground">
        Hubungi pengurus ranting/cabang untuk pertanyaan administratif.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !conversation ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {hint || "Pesan belum tersedia."}
        </div>
      ) : (
        <div className="flex min-h-[420px] flex-col rounded-2xl border border-border/60 bg-card">
          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {conversation.messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Belum ada pesan. Tulis pesan pertama Anda.
              </p>
            ) : (
              conversation.messages.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <div
                    key={m.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-inkai-red text-white"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {!mine && m.sender?.fullName ? (
                        <p className="mb-0.5 text-[10px] opacity-70">
                          {m.sender.fullName}
                        </p>
                      ) : null}
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "opacity-80" : "text-muted-foreground"}`}>
                        {new Date(m.createdAt).toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex gap-2 border-t border-border/60 p-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Tulis pesan..."
              className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm"
            />
            <Button
              className="h-10 bg-inkai-red hover:bg-inkai-red/90"
              disabled={sending || !text.trim()}
              onClick={() => void send()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
