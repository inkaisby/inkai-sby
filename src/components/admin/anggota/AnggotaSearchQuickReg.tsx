"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatMemberName, formatRankLabel } from "@/lib/belt";
import type { ActiveRegistrationPeriod } from "@/lib/active-registration-periods";
import type { EventRegistrationKind } from "@/lib/event-quick-register";
import { EventQuickRegisterButtons } from "@/components/admin/event-quick-register/EventQuickRegisterButtons";

type Suggestion = {
  id: string;
  fullName: string;
  nia: string | null;
  dojoName?: string;
  currentRank?: string;
  registeredUkt?: boolean;
  registeredLatber?: boolean;
};

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  activeUkt: ActiveRegistrationPeriod;
  activeLatber: ActiveRegistrationPeriod;
  canQuickReg?: boolean;
  dojoFilter?: string;
  disabled?: boolean;
};

export function AnggotaSearchQuickReg({
  query,
  onQueryChange,
  activeUkt,
  activeLatber,
  canQuickReg = false,
  dojoFilter = "",
  disabled = false,
}: Props) {
  const [localQ, setLocalQ] = useState(query);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalQ(query);
    }
  }, [query]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!canQuickReg || disabled) {
      setSuggestions([]);
      return;
    }
    const q = localQ.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q });
      if (dojoFilter) params.set("dojo", dojoFilter);
      if (activeUkt?.id) params.set("uktEventId", activeUkt.id);
      if (activeLatber?.id) params.set("latberEventId", activeLatber.id);
      void fetch(`/api/admin/ukt/suggest?${params}`)
        .then(async (res) => {
          const data = (await res.json()) as { suggestions?: Suggestion[] };
          setSuggestions(res.ok ? (data.suggestions ?? []) : []);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [localQ, canQuickReg, dojoFilter, disabled, activeUkt?.id, activeLatber?.id]);

  const handleInput = (value: string) => {
    setLocalQ(value);
    setOpen(value.trim().length >= 2);
    onQueryChange(value);
  };

  function applySearchFromSuggestion(name: string) {
    setLocalQ(name);
    onQueryChange(name);
    setOpen(false);
  }

  function markRegistered(memberId: string, kind: EventRegistrationKind) {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === memberId
          ? {
              ...s,
              registeredUkt: kind === "ukt" ? true : s.registeredUkt,
              registeredLatber: kind === "latber" ? true : s.registeredLatber,
            }
          : s,
      ),
    );
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0 w-full overflow-visible">
      <Input
        ref={inputRef}
        value={localQ}
        disabled={disabled}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => localQ.trim().length >= 2 && setOpen(true)}
        placeholder="Cari nama / NIA / MSH..."
        autoComplete="off"
        className="h-10 sm:h-8"
      />
      {canQuickReg && open && (suggestions.length > 0 || loading) ? (
        <ul className="absolute z-50 mt-1 max-h-72 w-full min-w-[16rem] overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
          {loading && suggestions.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Mencari…
            </li>
          ) : null}
          {suggestions.map((m) => {
            const showUkt = Boolean(activeUkt) && !m.registeredUkt;
            const showLatber = Boolean(activeLatber) && !m.registeredLatber;
            const showActions = showUkt || showLatber;
            return (
              <li
                key={m.id}
                className="border-b border-border/40 px-3 py-2 last:border-0"
              >
                <div
                  className="min-w-0 cursor-pointer rounded-sm hover:bg-muted/60"
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySearchFromSuggestion(m.fullName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      applySearchFromSuggestion(m.fullName);
                    }
                  }}
                >
                  <p className="truncate font-medium">{formatMemberName(m.fullName)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[
                      m.nia,
                      formatRankLabel(m.currentRank || "") || m.currentRank,
                      m.dojoName || "—",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {showActions ? (
                  <div className="mt-2">
                    <EventQuickRegisterButtons
                      variant="both"
                      memberId={m.id}
                      uktEventId={activeUkt?.id}
                      latberEventId={activeLatber?.id}
                      registeredUkt={m.registeredUkt}
                      registeredLatber={m.registeredLatber}
                      onRegistered={(kind) => markRegistered(m.id, kind)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
