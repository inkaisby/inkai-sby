"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  ArrowLeft,
  Plus,
  Trash2,
  Settings,
  Scale,
  DollarSign,
  Users,
  Swords,
  Shield,
  Calendar,
  Pencil,
  Eye,
  EyeOff,
  X,
  Zap,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  Archive,
  Copy,
  UserPlus,
  Loader2,
  Check,
  UserCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";
import { InkaiConfirmDialog } from "@/components/ui/InkaiConfirmDialog";
import { showError, showSuccess } from "@/lib/client-toast";

interface EventItem {
  id: string;
  title: string;
  isArchived?: boolean;
}

interface CategoryItem {
  id: string;
  eventId: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge?: number | null;
  maxAge?: number | null;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  fee: number;
  isFeeVisible?: boolean;
  _count?: { registrations: number };
}

interface EditCategoryForm {
  id: string;
  name: string;
  categoryType: string;
  gender: string;
  minAge: string;
  maxAge: string;
  minBirthDate: string;
  maxBirthDate: string;
  minWeight: string;
  maxWeight: string;
  fee: string;
  isFeeVisible: boolean;
}

interface DuplicateCategoryForm {
  name: string;
  categoryType: string;
  gender: string;
  minAge: string;
  maxAge: string;
  minBirthDate: string;
  maxBirthDate: string;
  minWeight: string;
  maxWeight: string;
  fee: string;
  isFeeVisible: boolean;
}

interface SuggestionMember {
  id: string;
  fullName: string;
  nia: string | null;
  dojoId: string | null;
  dojoName: string;
  currentRank: string;
  gender: string;
  birthDate: string;
  isRegistered?: boolean;
}

type SortField = "name" | "categoryType" | "birthDate" | "fee" | "registrations";
type SortDirection = "asc" | "desc";


interface DivisionPresetDef {
  id: string;
  name: string;
  ageLabel: string;
  minAge: number | null;
  maxAge: number | null;
  defaultMinBirth: string;
  defaultMaxBirth: string;
  weights: string[];
}

export const DIVISION_PRESETS: DivisionPresetDef[] = [
  {
    id: "PRA_USIA_DINI",
    name: "PRA USIA DINI",
    ageLabel: "6 - 7 TAHUN",
    minAge: 6,
    maxAge: 7,
    defaultMinBirth: "2019-04-10",
    defaultMaxBirth: "2021-04-09",
    weights: ["BEBAS", "-20", "-25", "+25"],
  },
  {
    id: "USIA_DINI",
    name: "USIA DINI",
    ageLabel: "8 - 9 TAHUN",
    minAge: 8,
    maxAge: 9,
    defaultMinBirth: "2017-04-10",
    defaultMaxBirth: "2019-04-09",
    weights: ["BEBAS", "-25", "-30", "+30", "-35", "+35"],
  },
  {
    id: "PRA_PEMULA",
    name: "PRA PEMULA",
    ageLabel: "10 - 11 TAHUN",
    minAge: 10,
    maxAge: 11,
    defaultMinBirth: "2015-04-10",
    defaultMaxBirth: "2017-04-09",
    weights: ["BEBAS", "-35", "-40", "+40", "-45", "+45"],
  },
  {
    id: "PEMULA",
    name: "PEMULA",
    ageLabel: "12 - 13 TAHUN",
    minAge: 12,
    maxAge: 13,
    defaultMinBirth: "2013-04-10",
    defaultMaxBirth: "2015-04-09",
    weights: ["BEBAS", "-35", "-40", "-45", "-50", "+50"],
  },
  {
    id: "KADET",
    name: "KADET",
    ageLabel: "14 - 15 TAHUN",
    minAge: 14,
    maxAge: 15,
    defaultMinBirth: "2011-04-10",
    defaultMaxBirth: "2013-04-09",
    weights: ["BEBAS", "-47", "-52", "-54", "-57", "-63", "-70", "+70"],
  },
  {
    id: "JUNIOR",
    name: "JUNIOR",
    ageLabel: "16 - 17 TAHUN",
    minAge: 16,
    maxAge: 17,
    defaultMinBirth: "2009-04-10",
    defaultMaxBirth: "2011-04-09",
    weights: ["BEBAS", "-48", "-53", "-55", "-59", "-61", "-68", "-76", "+76"],
  },
  {
    id: "UNDER_21",
    name: "UNDER-21 (U-21)",
    ageLabel: "18 - 20 TAHUN",
    minAge: 18,
    maxAge: 20,
    defaultMinBirth: "2006-04-10",
    defaultMaxBirth: "2009-04-09",
    weights: ["BEBAS", "-50", "-55", "-60", "-67", "-75", "-84", "+84"],
  },
  {
    id: "SENIOR",
    name: "SENIOR / UMUM",
    ageLabel: "21+ TAHUN",
    minAge: 21,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "2006-04-09",
    weights: ["BEBAS", "-50", "-55", "-60", "-67", "-75", "-84", "+84"],
  },
  {
    id: "VETERAN",
    name: "VETERAN",
    ageLabel: "35+ TAHUN",
    minAge: 35,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "1991-04-09",
    weights: ["BEBAS", "-65", "-75", "+75"],
  },
  {
    id: "CUSTOM",
    name: "KUSTOM / LAINNYA",
    ageLabel: "BEBAS USIA",
    minAge: null,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "",
    weights: ["BEBAS", "-25", "-30", "-35", "-40", "-45", "-50", "+50"],
  },
];

export function getCategoryDivisionMeta(cat: CategoryItem): {
  divisionName: string;
  ageLabel: string;
  birthDateLabel: string;
} {
  const nameUpper = (cat.name || "").toUpperCase();
  for (const p of DIVISION_PRESETS) {
    if (p.id === "CUSTOM") continue;
    if (
      nameUpper.includes(p.name) ||
      (cat.minAge === p.minAge && (cat.maxAge === p.maxAge || (!p.maxAge && !cat.maxAge)))
    ) {
      let bLabel = "";
      if (cat.minBirthDate || cat.maxBirthDate) {
        const d1 = cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
        const d2 = cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
        bLabel = `Kelahiran tanggal ${d1} s.d ${d2}`;
      } else if (p.defaultMinBirth && p.defaultMaxBirth) {
        const d1 = new Date(p.defaultMinBirth).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        const d2 = new Date(p.defaultMaxBirth).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        bLabel = `Kelahiran tanggal ${d1} s.d ${d2}`;
      } else {
        bLabel = "Kriteria Usia Standar Kejuaraan";
      }
      return {
        divisionName: p.name,
        ageLabel: p.ageLabel,
        birthDateLabel: bLabel,
      };
    }
  }

  let bLabel = "Kriteria Usia Standar Kejuaraan";
  if (cat.minBirthDate || cat.maxBirthDate) {
    const d1 = cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
    const d2 = cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
    bLabel = `Kelahiran tanggal ${d1} s.d ${d2}`;
  }
  return {
    divisionName: "KELAS LAINNYA",
    ageLabel: cat.minAge || cat.maxAge ? `${cat.minAge || 0} - ${cat.maxAge || "∞"} Tahun` : "Bebas Usia",
    birthDateLabel: bLabel,
  };
}

export function getEventNumberDisplay(cat: CategoryItem): string {
  const isTeam = cat.categoryType.endsWith("_TEAM");
  if (cat.categoryType.startsWith("KATA")) {
    return isTeam ? "KATA BEREGU" : "KATA PERORANGAN";
  }
  const prefix = isTeam ? "KUMITE BEREGU" : "KUMITE";
  if (cat.maxWeight && !cat.minWeight) {
    return `${prefix} -${cat.maxWeight} KG`;
  }
  if (cat.minWeight && !cat.maxWeight) {
    return `${prefix} +${Math.floor(cat.minWeight)} KG`;
  }
  if (cat.minWeight && cat.maxWeight) {
    return `${prefix} ${cat.minWeight}-${cat.maxWeight} KG`;
  }
  return `${prefix} PERORANGAN`;
}

export function buildGeneratedCategoryName(
  divisionPresetId: string,
  categoryType: string,
  gender: string,
  minWeight: string,
  maxWeight: string
): string {
  const divObj = DIVISION_PRESETS.find((d) => d.id === divisionPresetId) || DIVISION_PRESETS[0];
  const isTeam = categoryType.endsWith("_TEAM");
  let nomor = "";
  if (categoryType.startsWith("KATA")) {
    nomor = isTeam ? "Kata Beregu" : "Kata Perorangan";
  } else {
    const base = isTeam ? "Kumite Beregu" : "Kumite";
    if (maxWeight && !minWeight) {
      nomor = `${base} -${maxWeight} kg`;
    } else if (minWeight && !maxWeight) {
      nomor = `${base} +${Math.floor(parseFloat(minWeight))} kg`;
    } else if (minWeight && maxWeight) {
      nomor = `${base} ${minWeight}-${maxWeight} kg`;
    } else {
      nomor = isTeam ? "Kumite Beregu" : "Kumite Perorangan";
    }
  }

  let genderStr = "";
  if (gender === "MALE") genderStr = "Putra";
  else if (gender === "FEMALE") genderStr = "Putri";
  else if (gender === "MIXED") genderStr = "Campuran";
  else if (gender === "BOTH") genderStr = "(Putra & Putri)";

  if (divObj.id === "CUSTOM") {
    return `${nomor} ${genderStr}`.trim();
  }
  return `${divObj.name} - ${nomor} ${genderStr}`.trim();
}

export default function AdminPertandinganKategoriPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  // Table Sorting & Copy All State
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [copiedAll, setCopiedAll] = useState(false);

  // Multi-select Filter State
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [athleteFilterStatus, setAthleteFilterStatus] = useState<"ALL" | "WITH_ATHLETE" | "NO_ATHLETE">("ALL");
  const [feeFilterStatus, setFeeFilterStatus] = useState<"ALL" | "VISIBLE" | "HIDDEN">("ALL");
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // INKAI Custom Confirmation Modal State
  const [deleteCatState, setDeleteCatState] = useState<{ open: boolean; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Category Modal State
  const [editCatState, setEditCatState] = useState<EditCategoryForm | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Duplicate Category State
  const [duplicateCatState, setDuplicateCatState] = useState<DuplicateCategoryForm | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Athlete Search & Quick Registration Modal State
  const [athleteSuggestions, setAthleteSuggestions] = useState<SuggestionMember[]>([]);
  const [isSearchingAthlete, setIsSearchingAthlete] = useState(false);
  const [showAthleteDropdown, setShowAthleteDropdown] = useState(false);
  const [selectedAthleteForReg, setSelectedAthleteForReg] = useState<SuggestionMember | null>(null);
  const [selectedRegCategoryId, setSelectedRegCategoryId] = useState<string>("");
  const [regCategoryGenderFilter, setRegCategoryGenderFilter] = useState<"ALL" | "MATCHING">("MATCHING");
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Preset Generator State
  const [isGeneratingPreset, setIsGeneratingPreset] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [selectedDivisionGroup, setSelectedDivisionGroup] = useState<string>("ALL");
  const [presetFee, setPresetFee] = useState<string>("150000");

  // Batch Selection State
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [showBatchFeeModal, setShowBatchFeeModal] = useState(false);
  const [batchFeeInput, setBatchFeeInput] = useState<string>("150000");
  const [confirmBatchDeleteOpen, setConfirmBatchDeleteOpen] = useState(false);

  // Tampilan Tabel vs Bagan Matriks (Sesuai Gambar)
  const [tableViewMode, setTableViewMode] = useState<"TABLE" | "MATRIX">("TABLE");

  // State Form Tambah Kelas Cerdas
  const [selectedDivisionPreset, setSelectedDivisionPreset] = useState<string>("PRA_USIA_DINI");
  const [categoryKind, setCategoryKind] = useState<"KATA" | "KUMITE">("KATA");
  const [kumiteWeightPreset, setKumiteWeightPreset] = useState<string>("BEBAS");
  const [genderOption, setGenderOption] = useState<"MALE" | "FEMALE" | "MIXED" | "BOTH">("MALE");
  const [isAutoName, setIsAutoName] = useState<boolean>(true);

  // Form New Category
  const [newCat, setNewCat] = useState({
    name: "",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: "",
    maxAge: "",
    minBirthDate: "",
    maxBirthDate: "",
    minWeight: "",
    maxWeight: "",
    fee: "150000",
    isFeeVisible: true,
  });

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/pertandingan/events");
      const data = await res.json();
      if (data.events) {
        setEvents(data.events);
        if (data.events.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/categories?eventId=${selectedEventId}`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      setSelectedCategoryIds([]);
      fetchCategories();
    }
  }, [selectedEventId]);

  const handleBatchUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategoryIds.length === 0) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedCategoryIds,
          fee: parseFloat(batchFeeInput),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Berhasil memperbarui biaya ${selectedCategoryIds.length} kelas kategori menjadi Rp ${parseInt(batchFeeInput).toLocaleString("id-ID")}`);
        setShowBatchFeeModal(false);
        setSelectedCategoryIds([]);
        fetchCategories();
      } else {
        showError(data.error || "Gagal memperbarui biaya massal");
      }
    } catch (err: any) {
      showError(err.message || "Gagal memperbarui biaya massal");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBatchDeleteCategories = async () => {
    if (selectedCategoryIds.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedCategoryIds }),
      });
      const data = await res.json();
      if (data.success) {
        showSuccess(`Berhasil menghapus ${selectedCategoryIds.length} kelas kategori`);
        setConfirmBatchDeleteOpen(false);
        setSelectedCategoryIds([]);
        fetchCategories();
      } else {
        showError(data.error || "Gagal menghapus kategori massal");
      }
    } catch (err: any) {
      showError(err.message || "Gagal menghapus kategori massal");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;

    try {
      if (genderOption === "BOTH") {
        const nameMale = isAutoName
          ? buildGeneratedCategoryName(selectedDivisionPreset, newCat.categoryType, "MALE", newCat.minWeight, newCat.maxWeight)
          : `${newCat.name} (Putra)`;
        const nameFemale = isAutoName
          ? buildGeneratedCategoryName(selectedDivisionPreset, newCat.categoryType, "FEMALE", newCat.minWeight, newCat.maxWeight)
          : `${newCat.name} (Putri)`;

        const res = await fetch("/api/admin/pertandingan/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            items: [
              { ...newCat, eventId: selectedEventId, gender: "MALE", name: nameMale },
              { ...newCat, eventId: selectedEventId, gender: "FEMALE", name: nameFemale },
            ],
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showSuccess("Berhasil menambahkan 2 kelas (Putra & Putri) sekaligus!");
          fetchCategories();
        } else {
          showError(data.error || "Gagal menambah kategori");
        }
      } else {
        const finalName = isAutoName
          ? buildGeneratedCategoryName(selectedDivisionPreset, newCat.categoryType, newCat.gender, newCat.minWeight, newCat.maxWeight)
          : newCat.name;

        const res = await fetch("/api/admin/pertandingan/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: selectedEventId,
            ...newCat,
            name: finalName,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showSuccess("Kategori kelas pertandingan berhasil ditambahkan");
          fetchCategories();
        } else {
          showError(data.error || "Gagal menambah kategori");
        }
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menambah kategori");
    }
  };

  const handleSelectDivisionPreset = (presetId: string) => {
    setSelectedDivisionPreset(presetId);
    const p = DIVISION_PRESETS.find((x) => x.id === presetId);
    if (!p) return;

    setNewCat((prev) => ({
      ...prev,
      minAge: p.minAge !== null ? String(p.minAge) : "",
      maxAge: p.maxAge !== null ? String(p.maxAge) : "",
      minBirthDate: p.defaultMinBirth,
      maxBirthDate: p.defaultMaxBirth,
    }));
  };

  const handleSelectCategoryKind = (kind: "KATA" | "KUMITE") => {
    setCategoryKind(kind);
    if (kind === "KATA") {
      setNewCat((prev) => ({
        ...prev,
        categoryType: "KATA_INDIVIDUAL",
        minWeight: "",
        maxWeight: "",
      }));
      setKumiteWeightPreset("BEBAS");
    } else {
      setNewCat((prev) => ({
        ...prev,
        categoryType: "KUMITE_INDIVIDUAL",
      }));
    }
  };

  const handleSelectWeightPreset = (preset: string) => {
    setKumiteWeightPreset(preset);
    if (preset === "BEBAS") {
      setNewCat((prev) => ({ ...prev, minWeight: "", maxWeight: "" }));
    } else if (preset.startsWith("-")) {
      const val = preset.replace("-", "");
      setNewCat((prev) => ({ ...prev, minWeight: "", maxWeight: val }));
    } else if (preset.startsWith("+")) {
      const val = preset.replace("+", "");
      const num = parseFloat(val) + 0.1;
      setNewCat((prev) => ({ ...prev, minWeight: String(num), maxWeight: "" }));
    }
  };

  const handleGeneratePreset = async (group: string) => {
    if (!selectedEventId) return;
    setIsGeneratingPreset(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          divisionGroup: group,
          feeOverride: presetFee ? parseFloat(presetFee) : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(data.message || "Templat kategori berhasil ditambahkan");
        setPresetModalOpen(false);
        fetchCategories();
      } else {
        showError(data.error || "Gagal menerapkan templat kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat membuat templat kategori");
    } finally {
      setIsGeneratingPreset(false);
    }
  };

  const openEditCategory = (cat: CategoryItem) => {
    let minB = "";
    let maxB = "";
    if (cat.minBirthDate) {
      minB = new Date(cat.minBirthDate).toISOString().substring(0, 10);
    }
    if (cat.maxBirthDate) {
      maxB = new Date(cat.maxBirthDate).toISOString().substring(0, 10);
    }
    setEditCatState({
      id: cat.id,
      name: cat.name,
      categoryType: cat.categoryType,
      gender: cat.gender,
      minAge: cat.minAge !== null && cat.minAge !== undefined ? String(cat.minAge) : "",
      maxAge: cat.maxAge !== null && cat.maxAge !== undefined ? String(cat.maxAge) : "",
      minBirthDate: minB,
      maxBirthDate: maxB,
      minWeight: cat.minWeight !== null && cat.minWeight !== undefined ? String(cat.minWeight) : "",
      maxWeight: cat.maxWeight !== null && cat.maxWeight !== undefined ? String(cat.maxWeight) : "",
      fee: String(cat.fee),
      isFeeVisible: cat.isFeeVisible !== false,
    });
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatState) return;

    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editCatState.id,
          name: editCatState.name,
          categoryType: editCatState.categoryType,
          gender: editCatState.gender,
          minAge: editCatState.minAge,
          maxAge: editCatState.maxAge,
          minBirthDate: editCatState.minBirthDate || null,
          maxBirthDate: editCatState.maxBirthDate || null,
          minWeight: editCatState.minWeight,
          maxWeight: editCatState.maxWeight,
          fee: editCatState.fee,
          isFeeVisible: editCatState.isFeeVisible,
        }),
      });

      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil diperbarui");
        setEditCatState(null);
        fetchCategories();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal memperbarui kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat memperbarui kategori");
    } finally {
      setIsUpdating(false);
    }
  };

  const triggerDeleteCategory = (cat: CategoryItem) => {
    setDeleteCatState({ open: true, id: cat.id, name: cat.name });
  };

  const executeDeleteCategory = async () => {
    if (!deleteCatState) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pertandingan/categories?id=${deleteCatState.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil dihapus");
        fetchCategories();
        setDeleteCatState(null);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menghapus kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menghapus kategori");
    } finally {
      setIsDeleting(false);
    }
  };

  // Debounced athlete search when typing in search box
  useEffect(() => {
    if (!selectedEventId || searchQuery.trim().length < 2) {
      setAthleteSuggestions([]);
      setShowAthleteDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingAthlete(true);
      try {
        const res = await fetch(
          `/api/admin/pertandingan/suggest?q=${encodeURIComponent(searchQuery.trim())}&eventId=${selectedEventId}`
        );
        const data = await res.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setAthleteSuggestions(data.suggestions);
          setShowAthleteDropdown(true);
        } else {
          setAthleteSuggestions([]);
          setShowAthleteDropdown(false);
        }
      } catch (err) {
        console.error("Error searching athlete:", err);
      } finally {
        setIsSearchingAthlete(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedEventId]);

  // Handle click outside to close athlete search dropdown & filter popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowAthleteDropdown(false);
      }
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowFilterPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openDuplicateCategory = (cat: CategoryItem) => {
    let minB = "";
    let maxB = "";
    if (cat.minBirthDate) {
      minB = new Date(cat.minBirthDate).toISOString().substring(0, 10);
    }
    if (cat.maxBirthDate) {
      maxB = new Date(cat.maxBirthDate).toISOString().substring(0, 10);
    }
    setDuplicateCatState({
      name: `${cat.name} (Salinan)`,
      categoryType: cat.categoryType,
      gender: cat.gender,
      minAge: cat.minAge !== null && cat.minAge !== undefined ? String(cat.minAge) : "",
      maxAge: cat.maxAge !== null && cat.maxAge !== undefined ? String(cat.maxAge) : "",
      minBirthDate: minB,
      maxBirthDate: maxB,
      minWeight: cat.minWeight !== null && cat.minWeight !== undefined ? String(cat.minWeight) : "",
      maxWeight: cat.maxWeight !== null && cat.maxWeight !== undefined ? String(cat.maxWeight) : "",
      fee: String(cat.fee),
      isFeeVisible: cat.isFeeVisible !== false,
    });
  };

  const handleExecuteDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateCatState || !selectedEventId) return;

    setIsDuplicating(true);
    try {
      const res = await fetch("/api/admin/pertandingan/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          ...duplicateCatState,
        }),
      });

      if (res.ok) {
        showSuccess("Kategori kelas pertandingan berhasil diduplikasi");
        setDuplicateCatState(null);
        fetchCategories();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menduplikasi kategori");
      }
    } catch (err) {
      console.error(err);
      showError("Terjadi kesalahan saat menduplikasi kategori");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleCopyToNewForm = (form: DuplicateCategoryForm) => {
    setNewCat({
      name: form.name,
      categoryType: form.categoryType,
      gender: form.gender,
      minAge: form.minAge,
      maxAge: form.maxAge,
      minBirthDate: form.minBirthDate,
      maxBirthDate: form.maxBirthDate,
      minWeight: form.minWeight,
      maxWeight: form.maxWeight,
      fee: form.fee,
      isFeeVisible: form.isFeeVisible,
    });
    setDuplicateCatState(null);
    showSuccess("Data disalin ke formulir Tambah Kelas Baru di sebelah kiri");
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  const openRegisterModal = (athlete: SuggestionMember) => {
    setSelectedAthleteForReg(athlete);
    setShowAthleteDropdown(false);
    const matching = categories.filter((c) => c.gender === athlete.gender || c.gender === "MIXED");
    if (matching.length > 0) {
      setSelectedRegCategoryId(matching[0].id);
      setRegCategoryGenderFilter("MATCHING");
    } else if (categories.length > 0) {
      setSelectedRegCategoryId(categories[0].id);
      setRegCategoryGenderFilter("ALL");
    } else {
      setSelectedRegCategoryId("");
    }
  };

  const handleSubmitAthleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !selectedAthleteForReg || !selectedRegCategoryId) {
      showError("Pilih kelas pertandingan yang ingin diikuti atlet");
      return;
    }

    setIsSubmittingReg(true);
    try {
      const res = await fetch("/api/admin/pertandingan/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          dojoId: selectedAthleteForReg.dojoId,
          entries: [{ memberId: selectedAthleteForReg.id, categoryId: selectedRegCategoryId }],
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.skippedCount > 0) {
          showError(data.skipped[0]?.reason || "Atlet sudah terdaftar di kategori kelas ini");
        } else {
          const catName = categories.find((c) => c.id === selectedRegCategoryId)?.name || "kategori";
          showSuccess(`Atlet ${selectedAthleteForReg.fullName} berhasil didaftarkan ke ${catName}`);
          setSelectedAthleteForReg(null);
          setSelectedRegCategoryId("");
          fetchCategories();
        }
      } else {
        showError(data.error || "Gagal mendaftarkan atlet");
      }
    } catch (err: any) {
      showError(err.message || "Terjadi kesalahan saat mendaftarkan atlet");
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Multi-select Filter Helpers
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedTypes.length > 0) count += 1;
    if (selectedGenders.length > 0) count += 1;
    if (athleteFilterStatus !== "ALL") count += 1;
    if (feeFilterStatus !== "ALL") count += 1;
    return count;
  }, [selectedTypes, selectedGenders, athleteFilterStatus, feeFilterStatus]);

  const handleResetFilters = () => {
    setSelectedTypes([]);
    setSelectedGenders([]);
    setAthleteFilterStatus("ALL");
    setFeeFilterStatus("ALL");
    setFilterType("ALL");
    setSearchQuery("");
  };

  // Filter Categories with Multi-Select options
  const filteredCategories = categories.filter((cat) => {
    // 1. Text Search Query
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 2. Quick Filter Type (ALL / KATA / KUMITE)
    if (filterType === "KATA" && !cat.categoryType.startsWith("KATA")) return false;
    if (filterType === "KUMITE" && !cat.categoryType.startsWith("KUMITE")) return false;

    // 3. Multi-Select Types
    if (selectedTypes.length > 0 && !selectedTypes.includes(cat.categoryType)) {
      return false;
    }

    // 4. Multi-Select Genders
    if (selectedGenders.length > 0 && !selectedGenders.includes(cat.gender)) {
      return false;
    }

    // 5. Athlete Status
    const regCount = cat._count?.registrations || 0;
    if (athleteFilterStatus === "WITH_ATHLETE" && regCount === 0) return false;
    if (athleteFilterStatus === "NO_ATHLETE" && regCount > 0) return false;

    // 6. Fee Visibility Status
    if (feeFilterStatus === "VISIBLE" && cat.isFeeVisible === false) return false;
    if (feeFilterStatus === "HIDDEN" && cat.isFeeVisible !== false) return false;

    return true;
  });

  // Sort Categories
  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "name") {
        comparison = a.name.localeCompare(b.name, "id");
      } else if (sortField === "categoryType") {
        comparison = a.categoryType.localeCompare(b.categoryType, "id");
      } else if (sortField === "birthDate") {
        const aTime = a.minBirthDate
          ? new Date(a.minBirthDate).getTime()
          : (a.minAge !== null && a.minAge !== undefined ? a.minAge : 0) * 100000;
        const bTime = b.minBirthDate
          ? new Date(b.minBirthDate).getTime()
          : (b.minAge !== null && b.minAge !== undefined ? b.minAge : 0) * 100000;
        comparison = aTime - bTime;
      } else if (sortField === "fee") {
        comparison = (a.fee || 0) - (b.fee || 0);
      } else if (sortField === "registrations") {
        comparison = (a._count?.registrations || 0) - (b._count?.registrations || 0);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return list;
  }, [filteredCategories, sortField, sortDirection]);


  // Kelompokkan Kategori untuk Tampilan Bagan Matriks (Sesuai Gambar)
  const divisionGroups = useMemo(() => {
    interface DivisionCardData {
      key: string;
      divisionName: string;
      ageLabel: string;
      birthDateLabel: string;
      maleList: CategoryItem[];
      femaleList: CategoryItem[];
      mixedList: CategoryItem[];
    }

    const map = new Map<string, DivisionCardData>();

    sortedCategories.forEach((cat) => {
      const meta = getCategoryDivisionMeta(cat);
      const key = meta.divisionName;
      if (!map.has(key)) {
        map.set(key, {
          key,
          divisionName: meta.divisionName,
          ageLabel: meta.ageLabel,
          birthDateLabel: meta.birthDateLabel,
          maleList: [],
          femaleList: [],
          mixedList: [],
        });
      }
      const item = map.get(key)!;
      if (cat.gender === "MALE") item.maleList.push(cat);
      else if (cat.gender === "FEMALE") item.femaleList.push(cat);
      else item.mixedList.push(cat);
    });

    return Array.from(map.values());
  }, [sortedCategories]);

  const handleCopyCategories = async (onlySelected: boolean = false) => {
    const targetList = onlySelected
      ? sortedCategories.filter((c) => selectedCategoryIds.includes(c.id))
      : sortedCategories;

    if (targetList.length === 0) {
      showError(
        onlySelected
          ? "Tidak ada baris terpilih untuk disalin. Silakan centang baris terlebih dahulu."
          : "Tidak ada data kategori kelas untuk disalin."
      );
      return;
    }

    const header = [
      "No",
      "Nama Kelas",
      "Gender",
      "Jenis Kategori",
      "Kriteria Usia / Tgl Lahir",
      "Batas Berat Badan",
      "Biaya (Rp)",
      "Status Biaya",
      "Jumlah Atlet",
    ].join("\t");

    const rows = targetList.map((cat, idx) => {
      let tglOrUsia = "Semua Usia / Bebas";
      if (cat.minBirthDate || cat.maxBirthDate) {
        const minD = cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID") : "*";
        const maxD = cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID") : "*";
        tglOrUsia = `${minD} s/d ${maxD}`;
      } else if (cat.minAge || cat.maxAge) {
        tglOrUsia = `${cat.minAge || 0}-${cat.maxAge || "∞"} thn`;
      }

      let bb = "Bebas BB";
      if (cat.minWeight || cat.maxWeight) {
        bb = `${cat.minWeight ? `Min ${cat.minWeight}kg ` : ""}${cat.maxWeight ? `Max ${cat.maxWeight}kg` : ""}`.trim();
      }

      const statusBiaya = cat.isFeeVisible !== false ? "Ditampilkan" : "Disembunyikan";
      const totalAtlet = cat._count?.registrations || 0;

      return [
        idx + 1,
        cat.name,
        cat.gender,
        cat.categoryType,
        tglOrUsia,
        bb,
        cat.fee,
        statusBiaya,
        totalAtlet,
      ].join("\t");
    });

    const fullTsv = [header, ...rows].join("\n");

    try {
      await navigator.clipboard.writeText(fullTsv);
      setCopiedAll(true);
      showSuccess(
        `Berhasil menyalin ${targetList.length} data kategori kelas ke clipboard! ${
          onlySelected ? "(Baris Terpilih)" : "(Sesuai Filter & Urutan)"
        } Siap di-paste ke Excel / Spreadsheet.`
      );
      setTimeout(() => setCopiedAll(false), 2500);
    } catch (err) {
      console.error(err);
      showError("Gagal menyalin data kategori ke clipboard");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/pertandingan"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition text-zinc-600 dark:text-zinc-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Settings className="w-6 h-6 text-red-600" />
              Kelola Kelas Pertandingan & Biaya
            </h1>
            <p className="text-xs text-zinc-500">
              Penetapan Kelas Kata/Kumite, Rentang Usia/Tanggal Lahir, Kategori Open/Pelajar/Veteran/Disabilitas/BOB & Tarif Biaya
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPresetModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            Templat Kategori Standard (85+ Kelas)
          </button>

          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-white"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.isArchived ? "📦 [ARSIP] " : ""}{ev.title}
              </option>
            ))}
          </select>

          {events.find((e) => e.id === selectedEventId)?.isArchived && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
              <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              Diarsipkan
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Kategori Manual Cerdas (Sesuai Gambar) */}
        <div className="lg:col-span-4 xl:col-span-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4 h-fit">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-600" />
                Tambah Kelas Baru
              </h2>
              <p className="text-[11px] text-zinc-500">Sesuai format bagan kelas kejuaraan</p>
            </div>
            <button
              onClick={() => setPresetModalOpen(true)}
              className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline flex items-center gap-1 cursor-pointer bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/40"
            >
              <Sparkles className="w-3.5 h-3.5" /> 85+ Preset
            </button>
          </div>

          <form onSubmit={handleCreateCategory} className="space-y-3.5">
            {/* 1. Kelompok Usia / Divisi */}
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>1. Kelompok Usia / Divisi *</span>
                <span className="text-[10px] text-zinc-400 font-normal">Pilih kelompok usia</span>
              </label>
              <select
                value={selectedDivisionPreset}
                onChange={(e) => handleSelectDivisionPreset(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-red-500"
              >
                {DIVISION_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.ageLabel})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Jenis Nomor Pertandingan: KATA vs KUMITE */}
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                2. Nomor Pertandingan *
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleSelectCategoryKind("KATA")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    categoryKind === "KATA"
                      ? "bg-amber-500 text-zinc-950 border-amber-600 shadow-md ring-2 ring-amber-400/40"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  <span>KATA</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCategoryKind("KUMITE")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    categoryKind === "KUMITE"
                      ? "bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-400/40"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>KUMITE</span>
                </button>
              </div>

              {/* Sub-pilihan Kata / Kumite */}
              <div className="mt-2 p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    Bentuk:
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="catKindMode"
                        checked={
                          newCat.categoryType === "KATA_INDIVIDUAL" ||
                          newCat.categoryType === "KUMITE_INDIVIDUAL"
                        }
                        onChange={() =>
                          setNewCat((prev) => ({
                            ...prev,
                            categoryType:
                              categoryKind === "KATA" ? "KATA_INDIVIDUAL" : "KUMITE_INDIVIDUAL",
                          }))
                        }
                        className="text-red-600"
                      />
                      <span>Perorangan</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="catKindMode"
                        checked={
                          newCat.categoryType === "KATA_TEAM" ||
                          newCat.categoryType === "KUMITE_TEAM"
                        }
                        onChange={() =>
                          setNewCat((prev) => ({
                            ...prev,
                            categoryType:
                              categoryKind === "KATA" ? "KATA_TEAM" : "KUMITE_TEAM",
                          }))
                        }
                        className="text-red-600"
                      />
                      <span>Beregu</span>
                    </label>
                  </div>
                </div>

                {/* Khusus Kumite: Pilihan Cepat Berat Badan seperti di Gambar */}
                {categoryKind === "KUMITE" && (
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">
                      Pilihan Batas Berat Badan (BB):
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {(
                        DIVISION_PRESETS.find((x) => x.id === selectedDivisionPreset)?.weights || [
                          "BEBAS",
                          "-25",
                          "-30",
                          "+30",
                        ]
                      ).map((w) => {
                        const isSelected = kumiteWeightPreset === w;
                        const labelText =
                          w === "BEBAS"
                            ? "Bebas BB"
                            : w.startsWith("-")
                            ? `Under ${w.replace("-", "")} kg`
                            : `Over ${w.replace("+", "")} kg`;
                        return (
                          <button
                            key={w}
                            type="button"
                            onClick={() => handleSelectWeightPreset(w)}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                              isSelected
                                ? "bg-red-600 text-white border-red-700 shadow-xs"
                                : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                            }`}
                          >
                            {w === "BEBAS" ? "Bebas BB" : `${w} kg`}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setKumiteWeightPreset("CUSTOM")}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                          kumiteWeightPreset === "CUSTOM"
                            ? "bg-red-600 text-white border-red-700 shadow-xs"
                            : "bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        Kustom BB
                      </button>
                    </div>

                    {/* Input manual BB jika kustom */}
                    {kumiteWeightPreset === "CUSTOM" && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div>
                          <label className="text-[10px] text-zinc-500">Min BB (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="0"
                            value={newCat.minWeight}
                            onChange={(e) =>
                              setNewCat({ ...newCat, minWeight: e.target.value })
                            }
                            className="w-full mt-0.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500">Max BB (kg)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="30"
                            value={newCat.maxWeight}
                            onChange={(e) =>
                              setNewCat({ ...newCat, maxWeight: e.target.value })
                            }
                            className="w-full mt-0.5 px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Pilihan Gender Cerdas */}
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>3. Gender Peserta *</span>
                <span className="text-[10px] text-zinc-400 font-normal">Sesuai kolom gambar</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setGenderOption("MALE");
                    setNewCat({ ...newCat, gender: "MALE" });
                  }}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    genderOption === "MALE"
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span>PUTRA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderOption("FEMALE");
                    setNewCat({ ...newCat, gender: "FEMALE" });
                  }}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    genderOption === "FEMALE"
                      ? "bg-pink-600 text-white border-pink-700 shadow-sm"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span>PUTRI</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setGenderOption("MIXED");
                    setNewCat({ ...newCat, gender: "MIXED" });
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                    genderOption === "MIXED"
                      ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span>CAMPURAN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderOption("BOTH");
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                    genderOption === "BOTH"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400/40"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
                  }`}
                  title="Membuat 2 kelas kembar (Putra & Putri) sekaligus dalam sekali simpan"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PUTRA & PUTRI (2x)</span>
                </button>
              </div>
            </div>

            {/* 4. Preview / Input Nama Kelas */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  4. Nama Kelas Pertandingan *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (isAutoName) {
                      setNewCat((prev) => ({
                        ...prev,
                        name: buildGeneratedCategoryName(
                          selectedDivisionPreset,
                          prev.categoryType,
                          genderOption === "BOTH" ? "MALE" : prev.gender,
                          prev.minWeight,
                          prev.maxWeight
                        ),
                      }));
                    }
                    setIsAutoName(!isAutoName);
                  }}
                  className="text-[10px] text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  {isAutoName ? "✏️ Edit Manual" : "✨ Otomatis"}
                </button>
              </div>

              {isAutoName ? (
                <div className="mt-1 p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-amber-950 dark:text-amber-200">
                  {buildGeneratedCategoryName(
                    selectedDivisionPreset,
                    newCat.categoryType,
                    genderOption,
                    newCat.minWeight,
                    newCat.maxWeight
                  )}
                  <span className="block text-[10px] font-normal text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    ✨ Format nama otomatis standar bagan kejuaraan
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="mis. Pra Usia Dini - Kata Perorangan Putra"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
                />
              )}
            </div>

            {/* 5. Rentang Tanggal Lahir (Kriteria Kelayakan) */}
            <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 space-y-2">
              <span className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  Kriteria Rentang Kelahiran
                </span>
                <span className="text-[10px] font-normal text-zinc-500">
                  {newCat.minAge || newCat.maxAge ? `${newCat.minAge || 0}-${newCat.maxAge || "∞"} Thn` : "Bebas"}
                </span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Awal (Min Tgl)</label>
                  <input
                    type="date"
                    value={newCat.minBirthDate}
                    onChange={(e) => setNewCat({ ...newCat, minBirthDate: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Akhir (Max Tgl)</label>
                  <input
                    type="date"
                    value={newCat.maxBirthDate}
                    onChange={(e) => setNewCat({ ...newCat, maxBirthDate: e.target.value })}
                    className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 6. Biaya Pertandingan & Toggle */}
            <div>
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Biaya Pertandingan (Rp) *</label>
              <input
                type="number"
                required
                placeholder="150000"
                value={newCat.fee}
                onChange={(e) => setNewCat({ ...newCat, fee: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>

            {/* Checkbox Option Tampilkan Biaya */}
            <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newIsFeeVisible"
                  checked={newCat.isFeeVisible}
                  onChange={(e) => setNewCat({ ...newCat, isFeeVisible: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="newIsFeeVisible" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center gap-1.5">
                  {newCat.isFeeVisible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  Tampilkan Biaya
                </label>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${newCat.isFeeVisible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                {newCat.isFeeVisible ? "Ditampilkan" : "Disembunyikan"}
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {genderOption === "BOTH"
                ? "Simpan 2 Kelas Sekaligus (Putra & Putri)"
                : "Simpan Kategori Kelas"}
            </button>
          </form>
        </div>

        {/* Tabel Daftar Kategori */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm space-y-0">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-red-600" />
              Daftar Kategori Kelas ({sortedCategories.length} dari {categories.length})
            </h2>

            {/* View Mode Toggle: Tabel vs Bagan Matriks (Sesuai Gambar) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
                <button
                  type="button"
                  onClick={() => setTableViewMode("TABLE")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    tableViewMode === "TABLE"
                      ? "bg-white dark:bg-zinc-900 text-red-600 shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                  title="Tampilan Kolom Tabel Standar yang Rapi"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabel Rinci</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableViewMode("MATRIX")}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    tableViewMode === "MATRIX"
                      ? "bg-amber-500 text-zinc-950 shadow-xs font-black"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                  title="Tampilan Bagan Matriks (Putra / Putri per Kelompok Usia seperti di Gambar)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Bagan Matriks</span>
                </button>
              </div>
            </div>

            {/* Controls Search & Filter & Copy All */}
            <div className="flex items-center gap-2">
              <div ref={searchContainerRef} className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Cari nama kelas atau atlet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (athleteSuggestions.length > 0) setShowAthleteDropdown(true);
                  }}
                  className="pl-8 pr-8 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs w-52 sm:w-72 md:w-80"
                />
                {isSearchingAthlete ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2.5 top-2.5 text-zinc-400" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setAthleteSuggestions([]);
                      setShowAthleteDropdown(false);
                    }}
                    className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}

                {/* Dropdown Pencarian Atlet */}
                {showAthleteDropdown && athleteSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto animate-in fade-in duration-150">
                    <div className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-red-600" />
                        Atlet Ditemukan ({athleteSuggestions.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAthleteDropdown(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {athleteSuggestions.map((athlete) => (
                        <div
                          key={athlete.id}
                          className="p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition flex items-center justify-between gap-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                              <span>{athlete.fullName}</span>
                              {athlete.gender && (
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                    athlete.gender === "MALE"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                      : "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300"
                                  }`}
                                >
                                  {athlete.gender === "MALE" ? "Putra" : "Putri"}
                                </span>
                              )}
                              {athlete.nia && (
                                <span className="text-[10px] text-zinc-400 font-mono">({athlete.nia})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                              {athlete.dojoName} ·{" "}
                              <span className="font-medium text-red-600 dark:text-red-400">
                                {athlete.currentRank}
                              </span>
                              {athlete.birthDate &&
                                ` · 🎂 ${new Date(athlete.birthDate).toLocaleDateString("id-ID")}`}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {athlete.isRegistered && (
                              <span className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-semibold border border-emerald-200 dark:border-emerald-900/40">
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                Terdaftar
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openRegisterModal(athlete)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs transition shadow flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              Daftarkan
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold"
              >
                <option value="ALL">Semua Jenis</option>
                <option value="KATA">Kata</option>
                <option value="KUMITE">Kumite</option>
              </select>

              {/* Filter Popover Dropdown (Multi-Select) */}
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                  className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                    activeFilterCount > 0
                      ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400"
                      : "bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  }`}
                  title="Filter Berdasarkan Beberapa Kriteria"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {showFilterPopover && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-30 p-3.5 space-y-3.5 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-red-600" />
                        <span>Filter Kategori Kelas</span>
                      </div>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Filter Jenis Kategori (Multi Checkbox) */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Jenis Kategori
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "KATA_INDIVIDUAL", label: "Kata Perorangan" },
                          { id: "KATA_TEAM", label: "Kata Beregu" },
                          { id: "KUMITE_INDIVIDUAL", label: "Kumite Perorangan" },
                          { id: "KUMITE_TEAM", label: "Kumite Beregu" },
                        ].map((item) => {
                          const isChecked = selectedTypes.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer text-[11px] transition select-none ${
                                isChecked
                                  ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 font-medium"
                                  : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTypes([...selectedTypes, item.id]);
                                  } else {
                                    setSelectedTypes(selectedTypes.filter((t) => t !== item.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="truncate">{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filter Gender (Multi Checkbox) */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Gender
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "MALE", label: "Putra" },
                          { id: "FEMALE", label: "Putri" },
                          { id: "MIXED", label: "Campuran" },
                        ].map((item) => {
                          const isChecked = selectedGenders.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer text-[11px] transition select-none ${
                                isChecked
                                  ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-900/60 text-red-700 dark:text-red-300 font-medium"
                                  : "border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGenders([...selectedGenders, item.id]);
                                  } else {
                                    setSelectedGenders(selectedGenders.filter((g) => g !== item.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-zinc-300 text-red-600 focus:ring-red-500"
                              />
                              <span className="truncate">{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filter Status Atlet */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Status Pendaftaran Atlet
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-lg">
                        {[
                          { id: "ALL", label: "Semua" },
                          { id: "WITH_ATHLETE", label: "Ada Atlet" },
                          { id: "NO_ATHLETE", label: "Kosong" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAthleteFilterStatus(opt.id as any)}
                            className={`py-1 text-[11px] rounded-md font-medium transition cursor-pointer ${
                              athleteFilterStatus === opt.id
                                ? "bg-white dark:bg-zinc-900 text-red-600 shadow-sm font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter Status Biaya */}
                    <div>
                      <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                        Tampilan Biaya
                      </div>
                      <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-lg">
                        {[
                          { id: "ALL", label: "Semua" },
                          { id: "VISIBLE", label: "Tampil" },
                          { id: "HIDDEN", label: "Sembunyi" },
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFeeFilterStatus(opt.id as any)}
                            className={`py-1 text-[11px] rounded-md font-medium transition cursor-pointer ${
                              feeFilterStatus === opt.id
                                ? "bg-white dark:bg-zinc-900 text-red-600 shadow-sm font-semibold"
                                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">
                        {filteredCategories.length} kelas cocok
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFilterPopover(false)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tombol Copy Salin Isi Tabel (Semua / Terpilih) */}
              <div className="flex items-center gap-1 shrink-0">
                {selectedCategoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleCopyCategories(true)}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Salin baris yang dicentang ke clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Salin Terpilih</span> ({selectedCategoryIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleCopyCategories(false)}
                  disabled={sortedCategories.length === 0}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  title="Salin seluruh isi tabel kategori ke clipboard (format Excel / Spreadsheet)"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Salin Semua</span> ({sortedCategories.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Chips */}
          {(activeFilterCount > 0 || searchQuery) && (
            <div className="px-4 py-2 bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-zinc-400 font-medium">Filter Aktif:</span>
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                  Cari: &quot;{searchQuery}&quot;
                  <button type="button" onClick={() => setSearchQuery("")} className="hover:text-red-500 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedTypes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
                  Jenis: {selectedTypes.length} dipilih
                  <button type="button" onClick={() => setSelectedTypes([])} className="hover:text-red-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedGenders.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
                  Gender: {selectedGenders.map((g) => (g === "MALE" ? "Putra" : g === "FEMALE" ? "Putri" : "Campuran")).join(", ")}
                  <button type="button" onClick={() => setSelectedGenders([])} className="hover:text-red-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {athleteFilterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
                  Atlet: {athleteFilterStatus === "WITH_ATHLETE" ? "Ada Atlet" : "Kosong"}
                  <button type="button" onClick={() => setAthleteFilterStatus("ALL")} className="hover:text-red-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {feeFilterStatus !== "ALL" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-medium">
                  Biaya: {feeFilterStatus === "VISIBLE" ? "Ditampilkan" : "Disembunyikan"}
                  <button type="button" onClick={() => setFeeFilterStatus("ALL")} className="hover:text-red-900 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-red-600 hover:text-red-700 font-semibold underline text-[11px] ml-1 cursor-pointer"
              >
                Reset Semua
              </button>
            </div>
          )}

          {/* Tampilan 1: Mode Tabel Rinci (Kolom Rapi & Enak Dibaca) */}
          {tableViewMode === "TABLE" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                    <th className="py-2.5 px-2.5 w-9 text-center">
                      <input
                        type="checkbox"
                        checked={sortedCategories.length > 0 && selectedCategoryIds.length === sortedCategories.length}
                        onChange={() => {
                          if (selectedCategoryIds.length === sortedCategories.length) {
                            setSelectedCategoryIds([]);
                          } else {
                            setSelectedCategoryIds(sortedCategories.map((c) => c.id));
                          }
                        }}
                        title="Centang / Hapus Centang Semua"
                        className="w-4 h-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                    </th>
                    <th
                      onClick={() => handleSort("name")}
                      className="py-2.5 px-3 min-w-[180px] cursor-pointer select-none group hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                      title="Klik untuk mengurutkan Nama Kelas"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Nama Kelas & Nomor</span>
                        {sortField === "name" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      <span>Kelompok Usia</span>
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span>Gender</span>
                    </th>
                    <th
                      onClick={() => handleSort("categoryType")}
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer select-none group hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                      title="Klik untuk mengurutkan Jenis Kategori"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Nomor / Jenis</span>
                        {sortField === "categoryType" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("birthDate")}
                      className="py-2.5 px-3 min-w-[150px] cursor-pointer select-none group hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                      title="Klik untuk mengurutkan Kriteria Usia/Tgl Lahir"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Kriteria Kelahiran</span>
                        {sortField === "birthDate" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span>Batas BB</span>
                    </th>
                    <th
                      onClick={() => handleSort("fee")}
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer select-none group hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                      title="Klik untuk mengurutkan Biaya Cabang"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Biaya</span>
                        {sortField === "fee" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("registrations")}
                      className="py-2.5 px-3 text-center whitespace-nowrap cursor-pointer select-none group hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 transition"
                      title="Klik untuk mengurutkan Jumlah Atlet"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Atlet</span>
                        {sortField === "registrations" ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400 opacity-60 group-hover:opacity-100 transition" />
                        )}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-zinc-500">
                        Memuat kategori...
                      </td>
                    </tr>
                  ) : sortedCategories.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-zinc-500">
                        {categories.length === 0
                          ? "Belum ada kategori kelas pada event ini. Klik 'Templat Kategori Standard' untuk menambahkan 85+ kelas otomatis."
                          : "Tidak ada kategori yang cocok dengan pencarian / filter aktif."}
                      </td>
                    </tr>
                  ) : (
                    sortedCategories.map((cat) => {
                      const divMeta = getCategoryDivisionMeta(cat);
                      const nomorDisplay = getEventNumberDisplay(cat);
                      return (
                        <tr key={cat.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition">
                          <td className="py-2.5 px-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedCategoryIds.includes(cat.id)}
                              onChange={() => {
                                setSelectedCategoryIds((prev) =>
                                  prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                                );
                              }}
                              className="w-4 h-4 rounded border-zinc-300 text-red-600 focus:ring-red-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white text-xs sm:text-sm">
                            <div className="font-bold">{cat.name}</div>
                            <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-0.5">
                              {nomorDisplay}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                              {divMeta.divisionName}
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-0.5">{divMeta.ageLabel}</div>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wider ${
                                cat.gender === "MALE"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40"
                                  : cat.gender === "FEMALE"
                                  ? "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-900/40"
                                  : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40"
                              }`}
                            >
                              {cat.gender === "MALE" ? "PUTRA" : cat.gender === "FEMALE" ? "PUTRI" : "CAMPURAN"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                cat.categoryType.startsWith("KATA")
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                              }`}
                            >
                              {cat.categoryType === "KATA_INDIVIDUAL"
                                ? "Kata Perorangan"
                                : cat.categoryType === "KATA_TEAM"
                                ? "Kata Beregu"
                                : cat.categoryType === "KUMITE_TEAM"
                                ? "Kumite Beregu"
                                : "Kumite Perorangan"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-zinc-600 dark:text-zinc-400">
                            {cat.minBirthDate || cat.maxBirthDate ? (
                              <div className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200 whitespace-nowrap font-medium">
                                🎂 {cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "*"} s.d{" "}
                                {cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "*"}
                              </div>
                            ) : cat.minAge || cat.maxAge ? (
                              <div className="whitespace-nowrap font-medium">{cat.minAge || 0}-{cat.maxAge || "∞"} Thn</div>
                            ) : (
                              <div className="whitespace-nowrap text-zinc-400">Semua Usia / Bebas</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {cat.maxWeight && !cat.minWeight ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                -{cat.maxWeight} kg
                              </span>
                            ) : cat.minWeight && !cat.maxWeight ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                +{Math.floor(cat.minWeight)} kg
                              </span>
                            ) : cat.minWeight && cat.maxWeight ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                                {cat.minWeight} - {cat.maxWeight} kg
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-400">Bebas BB</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                              Rp {cat.fee.toLocaleString("id-ID")}
                            </div>
                            <div className="mt-0.5">
                              {cat.isFeeVisible !== false ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                                  <Eye className="w-3 h-3" /> Ditampilkan
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900/50">
                                  <EyeOff className="w-3 h-3" /> Disembunyikan
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                            {cat._count?.registrations || 0}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openDuplicateCategory(cat)}
                                className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg transition cursor-pointer"
                                title="Duplikat Kategori Kelas Ini"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCategory(cat)}
                                className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg transition cursor-pointer"
                                title="Edit Kategori Kelas Ini"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => triggerDeleteCategory(cat)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 rounded-lg transition cursor-pointer"
                                title="Hapus Kategori Kelas Ini"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Tampilan 2: Mode Bagan Matriks (Sesuai Gambar Dokumen Pertandingan) */
            <div className="p-4 bg-zinc-950 text-white min-h-[400px]">
              <div className="mb-4 flex items-center justify-between pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-6 bg-amber-400 rounded-xs" />
                  <h3 className="text-base sm:text-lg font-black tracking-wider uppercase text-amber-400">
                    BAGAN KELAS PERTANDINGAN
                  </h3>
                </div>
                <span className="text-xs text-zinc-400">
                  {divisionGroups.length} Divisi Kelompok Usia · {sortedCategories.length} Kelas
                </span>
              </div>

              {divisionGroups.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  Belum ada kelas kategori yang terdaftar pada event ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {divisionGroups.map((group) => {
                    const maxRows = Math.max(group.maleList.length, group.femaleList.length, 1);
                    return (
                      <div
                        key={group.key}
                        className="border border-zinc-700/80 rounded-xl overflow-hidden shadow-lg bg-zinc-900"
                      >
                        {/* Header Divisi Emas / Kuning Emas */}
                        <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-zinc-950 text-center py-2 px-3 shadow-sm">
                          <h4 className="font-black text-xs sm:text-sm tracking-wide uppercase">
                            {group.divisionName} ({group.ageLabel})
                          </h4>
                        </div>

                        {/* Subheader Kelahiran */}
                        <div className="bg-black/90 text-zinc-300 text-center text-[11px] font-medium py-1 px-2 border-b border-zinc-800">
                          {group.birthDateLabel}
                        </div>

                        {/* Kolom PUTRA dan PUTRI */}
                        <div className="grid grid-cols-2 bg-zinc-900/90 text-zinc-100 border-b border-zinc-700 text-xs font-black text-center">
                          <div className="py-1.5 border-r border-zinc-700 bg-amber-500/20 text-amber-300 tracking-wider">
                            PUTRA
                          </div>
                          <div className="py-1.5 bg-amber-500/20 text-amber-300 tracking-wider">
                            PUTRI
                          </div>
                        </div>

                        {/* Daftar Baris Nomor Pertandingan */}
                        <div className="divide-y divide-zinc-800 text-xs font-bold text-center">
                          {Array.from({ length: maxRows }).map((_, rIdx) => {
                            const maleCat = group.maleList[rIdx];
                            const femaleCat = group.femaleList[rIdx];

                            return (
                              <div key={rIdx} className="grid grid-cols-2 divide-x divide-zinc-800 hover:bg-zinc-800/40 transition">
                                {/* Sel Putra */}
                                <div className="p-2 flex flex-col items-center justify-center min-h-[52px]">
                                  {maleCat ? (
                                    <div className="w-full space-y-1">
                                      <div className="text-[11px] sm:text-xs font-black tracking-wide text-zinc-100 uppercase">
                                        {getEventNumberDisplay(maleCat)}
                                      </div>
                                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-normal">
                                        <span className="text-emerald-400 font-bold">
                                          Rp {maleCat.fee.toLocaleString("id-ID")}
                                        </span>
                                        <span>·</span>
                                        <span>{maleCat._count?.registrations || 0} Atlet</span>
                                        <button
                                          type="button"
                                          onClick={() => openEditCategory(maleCat)}
                                          className="text-blue-400 hover:text-blue-300 ml-1 cursor-pointer"
                                          title="Edit Kelas"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 text-[11px] italic">-</span>
                                  )}
                                </div>

                                {/* Sel Putri */}
                                <div className="p-2 flex flex-col items-center justify-center min-h-[52px]">
                                  {femaleCat ? (
                                    <div className="w-full space-y-1">
                                      <div className="text-[11px] sm:text-xs font-black tracking-wide text-zinc-100 uppercase">
                                        {getEventNumberDisplay(femaleCat)}
                                      </div>
                                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-normal">
                                        <span className="text-emerald-400 font-bold">
                                          Rp {femaleCat.fee.toLocaleString("id-ID")}
                                        </span>
                                        <span>·</span>
                                        <span>{femaleCat._count?.registrations || 0} Atlet</span>
                                        <button
                                          type="button"
                                          onClick={() => openEditCategory(femaleCat)}
                                          className="text-blue-400 hover:text-blue-300 ml-1 cursor-pointer"
                                          title="Edit Kelas"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 text-[11px] italic">-</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Baris Campuran jika ada */}
                        {group.mixedList.length > 0 && (
                          <div className="p-2 bg-purple-950/40 border-t border-zinc-800 text-center text-xs">
                            <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                              Kelas Campuran:
                            </span>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                              {group.mixedList.map((m) => (
                                <span
                                  key={m.id}
                                  className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 text-[11px] font-bold"
                                >
                                  {getEventNumberDisplay(m)} (Rp {m.fee.toLocaleString("id-ID")})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Templat Preset Kategori Standard INKAI / FORKI */}
      {presetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Tambah Templat Kategori Standard INKAI / FORKI
                </h3>
                <p className="text-xs text-zinc-500">
                  Pilih divisi dan tarif biaya awal. Kategori yang sudah ada tidak akan diduplikat.
                </p>
              </div>
              <button
                onClick={() => setPresetModalOpen(false)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Default Biaya Pendaftaran per Kategori (Rp)
                </label>
                <input
                  type="number"
                  value={presetFee}
                  onChange={(e) => setPresetFee(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  placeholder="150000"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Biaya dapat disesuaikan kembali per-kategori setelah templat berhasil ditambahkan.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Pilih Paket Divisi Kategori yang Ingin Ditambahkan:
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("ALL")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-left font-bold text-xs transition shadow flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> SEMUA KATEGORI LENGKAP</span>
                      <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">~85 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] opacity-90">
                      Termasuk Open, Pelajar, Veteran, Disabilitas, & BOB.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("OPEN")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-red-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>1. KATEGORI TERBUKA / OPEN</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">~45 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Pra Usia Dini, Usia Dini, Pra Pemula, Pemula, Kadet, Junior, U-21, Senior & Kumite Beregu
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("PELAJAR")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-blue-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>2. KATEGORI PELAJAR</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">~24 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      TK, SD 1-3, SD 4-6, SMP/MTs, SMA/SMK/MA, Mahasiswa/Umum
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("DISABILITAS")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>3. EKSEBISI DISABILITAS</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">6 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata Perorangan Rungu/Wicara, Daksa, & Grahita (Putra/Putri)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("VETERAN")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-purple-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>4. KATEGORI VETERAN</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">10 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata/Kumite 30-40 th, 40-50 th, & +50 th
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGeneratePreset("BOB")}
                    disabled={isGeneratingPreset}
                    className="p-3.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-yellow-50 dark:hover:bg-yellow-950/40 border border-zinc-300 dark:border-zinc-700 hover:border-yellow-400 text-zinc-900 dark:text-white rounded-xl text-left font-bold text-xs transition flex flex-col justify-between space-y-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center justify-between">
                      <span>5. BEST OF THE BEST (BOB)</span>
                      <span className="bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded text-[10px]">6 Kelas</span>
                    </span>
                    <span className="font-normal text-[11px] text-zinc-500 dark:text-zinc-400">
                      Kata & Kumite BOB Kadet-Junior / U21-Senior
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPresetModalOpen(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Kategori Kelas */}
      {editCatState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                Edit Kelas Pertandingan & Biaya
              </h3>
              <button
                onClick={() => setEditCatState(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nama Kelas Pertandingan *</label>
                <input
                  type="text"
                  required
                  value={editCatState.name}
                  onChange={(e) => setEditCatState({ ...editCatState, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Jenis Kategori *</label>
                  <select
                    value={editCatState.categoryType}
                    onChange={(e) => setEditCatState({ ...editCatState, categoryType: e.target.value })}
                    className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  >
                    <option value="KATA_INDIVIDUAL">Kata Perorangan</option>
                    <option value="KATA_TEAM">Kata Beregu</option>
                    <option value="KUMITE_INDIVIDUAL">Kumite Perorangan</option>
                    <option value="KUMITE_TEAM">Kumite Beregu</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Gender *</label>
                  <select
                    value={editCatState.gender}
                    onChange={(e) => setEditCatState({ ...editCatState, gender: e.target.value })}
                    className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  >
                    <option value="MALE">Putra (Male)</option>
                    <option value="FEMALE">Putri (Female)</option>
                    <option value="MIXED">Campuran (Mixed)</option>
                  </select>
                </div>
              </div>

              {/* Rentang Tanggal Lahir (Kriteria Kelayakan) */}
              <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 space-y-2">
                <span className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  Kriteria Rentang Tanggal Lahir
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Awal (Min Tgl)</label>
                    <input
                      type="date"
                      value={editCatState.minBirthDate}
                      onChange={(e) => setEditCatState({ ...editCatState, minBirthDate: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Akhir (Max Tgl)</label>
                    <input
                      type="date"
                      value={editCatState.maxBirthDate}
                      onChange={(e) => setEditCatState({ ...editCatState, maxBirthDate: e.target.value })}
                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Min BB (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editCatState.minWeight}
                    onChange={(e) => setEditCatState({ ...editCatState, minWeight: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Max BB (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editCatState.maxWeight}
                    onChange={(e) => setEditCatState({ ...editCatState, maxWeight: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Biaya Pertandingan (Rp) *</label>
                <input
                  type="number"
                  required
                  value={editCatState.fee}
                  onChange={(e) => setEditCatState({ ...editCatState, fee: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              {/* Checkbox Option Tampilkan Biaya */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="editIsFeeVisible"
                    checked={editCatState.isFeeVisible}
                    onChange={(e) => setEditCatState({ ...editCatState, isFeeVisible: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="editIsFeeVisible" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center gap-1.5">
                    {editCatState.isFeeVisible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                    Tampilkan Biaya Pertandingan
                  </label>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${editCatState.isFeeVisible ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"}`}>
                  {editCatState.isFeeVisible ? "Ditampilkan" : "Disembunyikan"}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditCatState(null)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INKAI Custom Confirmation Modal - Single Delete */}
      {deleteCatState && (
        <InkaiConfirmDialog
          open={deleteCatState.open}
          onOpenChange={(open) => {
            if (!open) setDeleteCatState(null);
          }}
          title="Hapus Kategori Kelas"
          description={`Apakah Anda yakin ingin menghapus kategori kelas "${deleteCatState.name}" dari kejuaraan ini?`}
          confirmLabel="Ya, Hapus Kategori"
          cancelLabel="Batal"
          variant="danger"
          loading={isDeleting}
          onConfirm={executeDeleteCategory}
        />
      )}

      {/* Modal Batch Edit Fee */}
      {showBatchFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-5 h-5 text-blue-600" />
                Ubah Biaya {selectedCategoryIds.length} Kategori Dicentang
              </h3>
              <button onClick={() => setShowBatchFeeModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBatchUpdateFee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Biaya Pendaftaran Baru (Rp) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={batchFeeInput}
                  onChange={(e) => setBatchFeeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  placeholder="150000"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Seluruh {selectedCategoryIds.length} kategori yang dicentang akan diperbarui biaya pendaftarannya sekaligus.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowBatchFeeModal(false)}
                  className="px-4 py-2 border border-zinc-300 text-xs font-semibold rounded-xl text-zinc-700 dark:text-zinc-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Biaya Massal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Dialog */}
      {confirmBatchDeleteOpen && (
        <InkaiConfirmDialog
          open={confirmBatchDeleteOpen}
          onOpenChange={(open) => setConfirmBatchDeleteOpen(open)}
          title={`Hapus ${selectedCategoryIds.length} Kategori Kelas`}
          description={`Apakah Anda yakin ingin menghapus ${selectedCategoryIds.length} kelas kategori yang dicentang secara permanen?`}
          confirmLabel={`Ya, Hapus ${selectedCategoryIds.length} Kategori`}
          cancelLabel="Batal"
          variant="danger"
          loading={isDeleting}
          onConfirm={handleBatchDeleteCategories}
        />
      )}

      {/* Modal Duplikat Kategori Kelas */}
      {duplicateCatState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-amber-600" />
                Duplikat Kelas Pertandingan & Biaya
              </h3>
              <button
                type="button"
                onClick={() => setDuplicateCatState(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteDuplicate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Nama Kelas Pertandingan Baru *
                </label>
                <input
                  type="text"
                  required
                  value={duplicateCatState.name}
                  onChange={(e) => setDuplicateCatState({ ...duplicateCatState, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Jenis Kategori *</label>
                  <select
                    value={duplicateCatState.categoryType}
                    onChange={(e) =>
                      setDuplicateCatState({ ...duplicateCatState, categoryType: e.target.value })
                    }
                    className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  >
                    <option value="KATA_INDIVIDUAL">Kata Perorangan</option>
                    <option value="KATA_TEAM">Kata Beregu</option>
                    <option value="KUMITE_INDIVIDUAL">Kumite Perorangan</option>
                    <option value="KUMITE_TEAM">Kumite Beregu</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Gender *</label>
                  <select
                    value={duplicateCatState.gender}
                    onChange={(e) => setDuplicateCatState({ ...duplicateCatState, gender: e.target.value })}
                    className="w-full mt-1 px-2.5 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  >
                    <option value="MALE">Putra (Male)</option>
                    <option value="FEMALE">Putri (Female)</option>
                    <option value="MIXED">Campuran (Mixed)</option>
                  </select>
                </div>
              </div>

              {/* Rentang Tanggal Lahir */}
              <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 space-y-2">
                <span className="text-xs font-bold text-red-900 dark:text-red-200 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-600" />
                  Kriteria Rentang Tanggal Lahir
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Awal (Min Tgl)</label>
                    <input
                      type="date"
                      value={duplicateCatState.minBirthDate}
                      onChange={(e) =>
                        setDuplicateCatState({ ...duplicateCatState, minBirthDate: e.target.value })
                      }
                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 dark:text-zinc-400">Paling Akhir (Max Tgl)</label>
                    <input
                      type="date"
                      value={duplicateCatState.maxBirthDate}
                      onChange={(e) =>
                        setDuplicateCatState({ ...duplicateCatState, maxBirthDate: e.target.value })
                      }
                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Min BB (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={duplicateCatState.minWeight}
                    onChange={(e) =>
                      setDuplicateCatState({ ...duplicateCatState, minWeight: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Batas Max BB (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={duplicateCatState.maxWeight}
                    onChange={(e) =>
                      setDuplicateCatState({ ...duplicateCatState, maxWeight: e.target.value })
                    }
                    className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Biaya Pertandingan (Rp) *
                </label>
                <input
                  type="number"
                  required
                  value={duplicateCatState.fee}
                  onChange={(e) => setDuplicateCatState({ ...duplicateCatState, fee: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-bold text-emerald-600 dark:text-emerald-400"
                />
              </div>

              {/* Checkbox Option Tampilkan Biaya */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="duplicateIsFeeVisible"
                    checked={duplicateCatState.isFeeVisible}
                    onChange={(e) =>
                      setDuplicateCatState({ ...duplicateCatState, isFeeVisible: e.target.checked })
                    }
                    className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label
                    htmlFor="duplicateIsFeeVisible"
                    className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer flex items-center gap-1.5"
                  >
                    {duplicateCatState.isFeeVisible ? (
                      <Eye className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-amber-600" />
                    )}
                    Tampilkan Biaya Pertandingan
                  </label>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    duplicateCatState.isFeeVisible
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  {duplicateCatState.isFeeVisible ? "Ditampilkan" : "Disembunyikan"}
                </span>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => handleCopyToNewForm(duplicateCatState)}
                  className="w-full sm:w-auto px-3 py-2 border border-dashed border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium rounded-xl transition cursor-pointer"
                >
                  Salin ke Form Manual
                </button>
                <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setDuplicateCatState(null)}
                    className="px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isDuplicating}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {isDuplicating ? "Menduplikasi..." : "Simpan Sebagai Kelas Baru"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Daftarkan Atlet ke Kelas Pertandingan */}
      {selectedAthleteForReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-red-600" />
                Daftarkan Atlet ke Kelas Pertandingan
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAthleteForReg(null)}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profil Singkat Atlet */}
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  {selectedAthleteForReg.fullName}
                  {selectedAthleteForReg.gender && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        selectedAthleteForReg.gender === "MALE"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                          : "bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300"
                      }`}
                    >
                      {selectedAthleteForReg.gender === "MALE" ? "Putra" : "Putri"}
                    </span>
                  )}
                </span>
                {selectedAthleteForReg.nia && (
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                    NIA: {selectedAthleteForReg.nia}
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Dojo: <strong className="text-zinc-800 dark:text-zinc-200">{selectedAthleteForReg.dojoName}</strong>
                </span>
                <span>
                  Tingkatan:{" "}
                  <strong className="text-red-600 dark:text-red-400">{selectedAthleteForReg.currentRank}</strong>
                </span>
                {selectedAthleteForReg.birthDate && (
                  <span>
                    Tgl Lahir:{" "}
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      {new Date(selectedAthleteForReg.birthDate).toLocaleDateString("id-ID")}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmitAthleteRegistration} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Pilih Kelas Pertandingan *
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setRegCategoryGenderFilter("MATCHING")}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition ${
                        regCategoryGenderFilter === "MATCHING"
                          ? "bg-red-600 text-white"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      Sesuai Gender ({selectedAthleteForReg.gender === "MALE" ? "Putra/Campuran" : "Putri/Campuran"})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegCategoryGenderFilter("ALL")}
                      className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer transition ${
                        regCategoryGenderFilter === "ALL"
                          ? "bg-red-600 text-white"
                          : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      Semua ({categories.length})
                    </button>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                    Belum ada kelas pertandingan pada kejuaraan ini. Silakan buat atau gunakan templat kelas terlebih dahulu.
                  </div>
                ) : (
                  <select
                    required
                    value={selectedRegCategoryId}
                    onChange={(e) => setSelectedRegCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
                  >
                    <option value="" disabled>
                      -- Pilih Kelas Pertandingan --
                    </option>
                    {categories
                      .filter((c) => {
                        if (regCategoryGenderFilter === "ALL") return true;
                        return c.gender === selectedAthleteForReg.gender || c.gender === "MIXED";
                      })
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.categoryType} · {cat.gender})
                          {cat.isFeeVisible !== false
                            ? ` — Rp ${cat.fee.toLocaleString("id-ID")}`
                            : " (Biaya Disembunyikan)"}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Rincian Kelas Terpilih */}
              {selectedRegCategoryId &&
                (() => {
                  const selCat = categories.find((c) => c.id === selectedRegCategoryId);
                  if (!selCat) return null;
                  return (
                    <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40 text-xs space-y-1.5">
                      <div className="font-bold text-red-900 dark:text-red-200 flex items-center justify-between">
                        <span>{selCat.name}</span>
                        {selCat.isFeeVisible !== false ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                            Biaya: Rp {selCat.fee.toLocaleString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-1">
                            <EyeOff className="w-3.5 h-3.5" /> Biaya Disembunyikan (Rp {selCat.fee.toLocaleString("id-ID")})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        {selCat.minBirthDate || selCat.maxBirthDate ? (
                          <div>
                            🎂 Rentang Tgl Lahir:{" "}
                            {selCat.minBirthDate
                              ? new Date(selCat.minBirthDate).toLocaleDateString("id-ID")
                              : "*"}{" "}
                            s/d{" "}
                            {selCat.maxBirthDate
                              ? new Date(selCat.maxBirthDate).toLocaleDateString("id-ID")
                              : "*"}
                          </div>
                        ) : selCat.minAge || selCat.maxAge ? (
                          <div>
                            Usia: {selCat.minAge || 0} - {selCat.maxAge || "∞"} tahun
                          </div>
                        ) : (
                          <div>Semua Usia / Bebas</div>
                        )}
                        <div>
                          Berat Badan:{" "}
                          {selCat.minWeight || selCat.maxWeight
                            ? `${selCat.minWeight ? `Min ${selCat.minWeight}kg ` : ""}${
                                selCat.maxWeight ? `Max ${selCat.maxWeight}kg` : ""
                              }`
                            : "Bebas"}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedAthleteForReg(null)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReg || !selectedRegCategoryId || categories.length === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingReg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Mendaftarkan...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Daftarkan Atlet ke Kelas Ini
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Batch Action Toolbar */}
      {selectedCategoryIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 text-white dark:bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            {selectedCategoryIds.length} Kategori Terpilih
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBatchFeeInput("150000");
                setShowBatchFeeModal(true);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" /> Ubah Biaya Massal
            </button>
            <button
              onClick={() => setConfirmBatchDeleteOpen(true)}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Massal
            </button>
            <button
              onClick={() => setSelectedCategoryIds([])}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
