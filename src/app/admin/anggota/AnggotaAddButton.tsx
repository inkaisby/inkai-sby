"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AddMemberDialog,
  type AddMemberDojoOption,
} from "@/components/admin/AddMemberDialog";

export function AnggotaAddButton({
  dojos,
  defaultDojoId,
  lockDojo,
}: {
  dojos: AddMemberDojoOption[];
  defaultDojoId?: string;
  lockDojo?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className="bg-inkai-red"
        onClick={() => setOpen(true)}
      >
        <UserPlus className="mr-1 h-4 w-4" />
        Tambah Anggota
      </Button>
      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        dojos={dojos}
        defaultDojoId={defaultDojoId}
        lockDojo={lockDojo}
        apiPath="/api/admin/members"
      />
    </>
  );
}
