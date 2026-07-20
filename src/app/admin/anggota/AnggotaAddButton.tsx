"use client";

import { useState } from "react";
import { TableProperties, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AddMemberDialog,
  type AddMemberDojoOption,
} from "@/components/admin/AddMemberDialog";
import { AddMembersBulkDialog } from "@/components/admin/AddMembersBulkDialog";

export function AnggotaAddButton({
  dojos,
  defaultDojoId,
  lockDojo,
  onMembersChanged,
}: {
  dojos: AddMemberDojoOption[];
  defaultDojoId?: string;
  lockDojo?: boolean;
  onMembersChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

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
      <Button
        type="button"
        variant="outline"
        onClick={() => setBulkOpen(true)}
      >
        <TableProperties className="mr-1 h-4 w-4" />
        Input Massal
      </Button>
      <AddMemberDialog
        open={open}
        onOpenChange={setOpen}
        dojos={dojos}
        defaultDojoId={defaultDojoId}
        lockDojo={lockDojo}
        apiPath="/api/admin/members"
      />
      <AddMembersBulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        dojos={dojos}
        defaultDojoId={defaultDojoId}
        lockDojo={lockDojo}
        onSuccess={onMembersChanged}
      />
    </>
  );
}
