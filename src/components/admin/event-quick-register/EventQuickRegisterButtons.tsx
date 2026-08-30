"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  registerMemberToEvent,
  type EventRegistrationKind,
} from "@/lib/event-quick-register";
import { showError, showSuccess } from "@/lib/client-toast";

export type EventQuickRegisterVariant = "ukt" | "latber" | "both";

type Props = {
  variant: EventQuickRegisterVariant;
  memberId: string;
  uktEventId?: string | null;
  latberEventId?: string | null;
  registeredUkt?: boolean;
  registeredLatber?: boolean;
  /** Bila diisi, abaikan POST internal (wajib untuk UKT dashboard). */
  onRegister?: (kind: EventRegistrationKind) => void | Promise<void>;
  onRegistered?: (kind: EventRegistrationKind) => void;
  pendingMemberId?: string | null;
  pendingKind?: EventRegistrationKind | null;
  uktDisabled?: boolean;
  uktDisabledTitle?: string;
  latberDisabled?: boolean;
  latberDisabledTitle?: string;
  extraActions?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  hidden?: boolean;
};

export function EventQuickRegisterButtons({
  variant,
  memberId,
  uktEventId,
  latberEventId,
  registeredUkt = false,
  registeredLatber = false,
  onRegister,
  onRegistered,
  pendingMemberId = null,
  pendingKind = null,
  uktDisabled = false,
  uktDisabledTitle,
  latberDisabled = false,
  latberDisabledTitle,
  extraActions,
  className,
  buttonClassName = "h-7 text-xs",
  disabled = false,
  hidden = false,
}: Props) {
  const [internalPendingKind, setInternalPendingKind] =
    useState<EventRegistrationKind | null>(null);

  if (hidden || disabled) return extraActions ? <>{extraActions}</> : null;

  const showUkt =
    (variant === "ukt" || variant === "both") &&
    Boolean(uktEventId) &&
    !registeredUkt;
  const showLatber =
    (variant === "latber" || variant === "both") &&
    Boolean(latberEventId) &&
    !registeredLatber;

  if (!showUkt && !showLatber && !extraActions) return null;

  async function runRegister(kind: EventRegistrationKind, eventId: string) {
    if (onRegister) {
      try {
        await onRegister(kind);
        onRegistered?.(kind);
      } catch {
        // Parent menampilkan toast error.
      }
      return;
    }
    setInternalPendingKind(kind);
    try {
      const result = await registerMemberToEvent(memberId, kind, eventId);
      if (result.ok) {
        showSuccess(
          kind === "ukt"
            ? "Anggota didaftarkan ke UKT"
            : "Anggota didaftarkan ke Latihan Bersama",
        );
        onRegistered?.(kind);
        return;
      }
      if (result.alreadyRegistered) {
        onRegistered?.(kind);
        return;
      }
      showError(result.error);
    } finally {
      setInternalPendingKind(null);
    }
  }

  const uktBusy =
    (pendingMemberId === memberId && pendingKind === "ukt") ||
    internalPendingKind === "ukt";
  const latberBusy =
    (pendingMemberId === memberId && pendingKind === "latber") ||
    internalPendingKind === "latber";

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {showUkt && uktEventId ? (
        <Button
          type="button"
          size="sm"
          variant={variant === "both" ? "default" : "outline"}
          className={buttonClassName}
          disabled={uktDisabled || uktBusy}
          title={
            typeof uktDisabledTitle === "string" ? uktDisabledTitle : undefined
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            void runRegister("ukt", uktEventId);
          }}
        >
          {uktBusy ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Mendaftar…
            </>
          ) : (
            "Daftar UKT"
          )}
        </Button>
      ) : null}
      {showLatber && latberEventId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={buttonClassName}
          disabled={latberDisabled || latberBusy}
          title={
            typeof latberDisabledTitle === "string"
              ? latberDisabledTitle
              : undefined
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            void runRegister("latber", latberEventId);
          }}
        >
          {latberBusy ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Mendaftar…
            </>
          ) : (
            "Daftar Latber"
          )}
        </Button>
      ) : null}
      {extraActions}
    </div>
  );
}
