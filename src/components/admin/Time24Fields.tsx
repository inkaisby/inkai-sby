"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HOURS_24,
  MINUTES_60,
  joinTimeInput,
  splitTimeInput,
} from "@/lib/ukt";

type Time24FieldsProps = {
  dateId: string;
  dateLabel: string;
  date: string;
  time: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
};

export function Time24Fields({
  dateId,
  dateLabel,
  date,
  time,
  onDateChange,
  onTimeChange,
}: Time24FieldsProps) {
  const parts = splitTimeInput(time || "00:00");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={dateId}>{dateLabel}</Label>
        <Input
          id={dateId}
          type="date"
          lang="id-ID"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Jam (24 jam)</Label>
        <div className="flex items-center gap-1.5">
          <Select
            value={parts.hour}
            onValueChange={(hour) => onTimeChange(joinTimeInput(hour, parts.minute))}
          >
            <SelectTrigger className="w-[4.5rem]">
              <SelectValue placeholder="JJ" />
            </SelectTrigger>
            <SelectContent className="max-h-52">
              {HOURS_24.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm font-semibold text-muted-foreground">.</span>
          <Select
            value={parts.minute}
            onValueChange={(minute) => onTimeChange(joinTimeInput(parts.hour, minute))}
          >
            <SelectTrigger className="w-[4.5rem]">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent className="max-h-52">
              {MINUTES_60.map((minute) => (
                <SelectItem key={minute} value={minute}>
                  {minute}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
