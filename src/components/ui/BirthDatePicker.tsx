"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calendar } from "lucide-react";

interface BirthDatePickerProps {
  value: string; // ISO format "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function getDaysInMonth(yearStr: string, monthStr: string): number {
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthStr, 10);
  if (isNaN(y) || isNaN(m)) return 31;
  return new Date(y, m, 0).getDate();
}

export function BirthDatePicker({
  value,
  onChange,
  disabled = false,
  className = "",
  minYear = 1940,
  maxYear = new Date().getFullYear(),
}: BirthDatePickerProps) {
  const [useNative, setUseNative] = useState(false);

  // Parse YYYY-MM-DD
  const { year, month, day } = useMemo(() => {
    if (!value || typeof value !== "string") {
      return { year: "", month: "", day: "" };
    }
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return { year: "", month: "", day: "" };
    }
    return {
      year: match[1],
      month: match[2],
      day: match[3],
    };
  }, [value]);

  const years = useMemo(() => {
    const list: string[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(String(y));
    }
    return list;
  }, [minYear, maxYear]);

  const maxDays = useMemo(() => {
    return getDaysInMonth(year, month);
  }, [year, month]);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= maxDays; d++) {
      list.push(d < 10 ? `0${d}` : String(d));
    }
    return list;
  }, [maxDays]);

  const handleDayChange = (newDay: string) => {
    if (!newDay) return;
    const y = year || String(new Date().getFullYear() - 15);
    const m = month || "01";
    onChange(`${y}-${m}-${newDay}`);
  };

  const handleMonthChange = (newMonth: string) => {
    if (!newMonth) return;
    const y = year || String(new Date().getFullYear() - 15);
    const d = day || "01";
    // Check if current day exceeds max days of new month
    const newMaxDays = getDaysInMonth(y, newMonth);
    const adjustedDay = parseInt(d, 10) > newMaxDays ? (newMaxDays < 10 ? `0${newMaxDays}` : String(newMaxDays)) : d;
    onChange(`${y}-${newMonth}-${adjustedDay}`);
  };

  const handleYearChange = (newYear: string) => {
    if (!newYear) return;
    const m = month || "01";
    const d = day || "01";
    const newMaxDays = getDaysInMonth(newYear, m);
    const adjustedDay = parseInt(d, 10) > newMaxDays ? (newMaxDays < 10 ? `0${newMaxDays}` : String(newMaxDays)) : d;
    onChange(`${newYear}-${m}-${adjustedDay}`);
  };

  if (useNative) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-8 w-full rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setUseNative(false)}
          title="Ganti ke mode Dropdown (Tgl / Bln / Thn)"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-input bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 w-full ${className}`}>
      {/* Tanggal */}
      <select
        value={day}
        onChange={(e) => handleDayChange(e.target.value)}
        disabled={disabled}
        className="h-8 flex-1 min-w-[3.5rem] rounded border border-input bg-background px-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        aria-label="Pilih Tanggal Lahir"
      >
        <option value="">Tgl</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {/* Bulan */}
      <select
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        disabled={disabled}
        className="h-8 flex-[1.5] min-w-[5.5rem] rounded border border-input bg-background px-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        aria-label="Pilih Bulan Lahir"
      >
        <option value="">Bulan</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Tahun */}
      <select
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        disabled={disabled}
        className="h-8 flex-1 min-w-[4.2rem] rounded border border-input bg-background px-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        aria-label="Pilih Tahun Lahir"
      >
        <option value="">Tahun</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Native Switch Button */}
      <button
        type="button"
        onClick={() => setUseNative(true)}
        title="Ganti ke mode Kalender Native"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-input bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      >
        <Calendar className="h-4 w-4" />
      </button>
    </div>
  );
}
