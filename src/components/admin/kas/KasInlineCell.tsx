"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { parseFlexibleIdDate } from "@/lib/parse-birth-date";
import { rupiahInt } from "@/lib/kas";

export type KasInlineKind = "text" | "date" | "money";

export function KasInlineCell({
  editable,
  display,
  initialValue,
  kind = "text",
  listId,
  className = "",
  align = "left",
  onCommit,
}: {
  editable: boolean;
  display: ReactNode;
  initialValue: string;
  kind?: KasInlineKind;
  listId?: string;
  className?: string;
  align?: "left" | "right";
  onCommit: (next: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(initialValue);
  }, [initialValue, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editable) {
    return (
      <td className={`p-2 ${align === "right" ? "text-right" : ""} ${className}`}>
        {display}
      </td>
    );
  }

  async function commit() {
    if (saving) return;
    let next = draft.trim();
    if (kind === "date") {
      const parsed = parseFlexibleIdDate(next) ?? (/^\d{4}-\d{2}-\d{2}$/.test(next) ? next : "");
      if (!parsed) {
        setDraft(initialValue);
        setEditing(false);
        return;
      }
      next = parsed;
    }
    if (kind === "money") {
      const n = next === "" ? 0 : rupiahInt(next.replace(/[^\d,.-]/g, ""));
      next = n > 0 ? String(n) : "";
    }
    if (next === initialValue || (kind === "money" && next === "" && initialValue === "0")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onCommit(next);
    setSaving(false);
    if (ok) {
      setEditing(false);
    } else {
      setDraft(initialValue);
      setEditing(false);
    }
  }

  if (!editing) {
    return (
      <td
        className={`cursor-text p-2 outline-none ring-inkai-red/40 hover:bg-muted/40 focus-visible:ring-2 ${
          align === "right" ? "text-right" : ""
        } ${className}`}
        tabIndex={0}
        title="Klik untuk ubah"
        onClick={() => {
          setDraft(initialValue);
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDraft(initialValue);
            setEditing(true);
          }
        }}
      >
        {display}
      </td>
    );
  }

  return (
    <td className={`p-1 ${align === "right" ? "text-right" : ""} ${className}`}>
      <Input
        ref={inputRef}
        type={kind === "date" ? "date" : "text"}
        list={listId}
        value={draft}
        disabled={saving}
        className={`h-8 text-sm ${align === "right" ? "text-right" : ""}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(initialValue);
            setEditing(false);
          }
        }}
      />
    </td>
  );
}
