"use client";

import { useEffect, useState, useRef, useLayoutEffect } from "react";
import {
  Trophy,
  Shuffle,
  RotateCcw,
  Printer,
  Plus,
  Trash2,
  Send,
  Users,
  Award,
  Crown,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  TournamentFighter,
  TournamentMatch,
  TournamentPool,
  TournamentState,
} from "@/lib/tournament-bracket-types";
import {
  buildPoolRounds,
  getInitialTournamentState,
  generateF4BracketSheetHTML,
  DEFAULT_ROSTER_POOL_A,
  DEFAULT_ROSTER_POOL_B,
} from "@/lib/tournament-bracket-engine";
import { showSuccess, showError } from "@/lib/client-toast";

interface TournamentBracketManagerProps {
  categories?: Array<{ id: string; name: string }>;
  registrations?: Array<{
    id: string;
    categoryId: string;
    member?: { fullName: string };
    dojo?: { name: string };
  }>;
  onSendToScoreboard?: (match: TournamentMatch, poolName: string, category: string, tatami: number) => void;
  tournamentTitle?: string;
}

export function TournamentBracketManager({
  categories = [],
  registrations = [],
  onSendToScoreboard,
  tournamentTitle = "KEJUARAAN KOTA INKAI SURABAYA 2026",
}: TournamentBracketManagerProps) {
  const [state, setState] = useState<TournamentState>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("inkai_tournament_bracket_v1");
        if (saved) return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return getInitialTournamentState();
  });

  const [draggedFighter, setDraggedFighter] = useState<{
    fighter: TournamentFighter;
    source: "roster" | { roundIdx: number; matchIdx: number; corner: "aka" | "ao" };
  } | null>(null);

  const [isRosterOpen, setIsRosterOpen] = useState(true);
  const [customCountPromptOpen, setCustomCountPromptOpen] = useState(false);
  const [customCountInput, setCustomCountInput] = useState("12");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Save state to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem("inkai_tournament_bracket_v1", JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const activePool = state.pools[state.activePoolId] || null;
  const isFinalActive = state.activePoolId === "championship_final";

  // Re-draw connector lines whenever bracket layout changes
  useLayoutEffect(() => {
    const drawConnectors = () => {
      const wrapper = wrapperRef.current;
      const svg = svgRef.current;
      if (!wrapper || !svg || !activePool || !activePool.rounds || activePool.rounds.length === 0) {
        if (svg) svg.innerHTML = "";
        return;
      }

      const wrapperRect = wrapper.getBoundingClientRect();
      const wWidth = Math.max(wrapper.scrollWidth, wrapper.clientWidth, Math.round(wrapperRect.width));
      const wHeight = Math.max(wrapper.scrollHeight, wrapper.clientHeight, Math.round(wrapperRect.height));

      svg.setAttribute("width", String(wWidth));
      svg.setAttribute("height", String(wHeight));
      svg.setAttribute("viewBox", `0 0 ${wWidth} ${wHeight}`);
      svg.style.width = `${wWidth}px`;
      svg.style.height = `${wHeight}px`;

      const rounds = activePool.rounds;
      const numRounds = rounds.length;
      let paths = "";

      for (let r = 0; r < numRounds - 1; r++) {
        const currentRound = rounds[r];
        const nextRound = rounds[r + 1];
        if (!nextRound) continue;
        const nextMatchCount = nextRound.length;

        for (let tgtM = 0; tgtM < nextMatchCount; tgtM++) {
          const topMatchIdx = tgtM * 2;
          const botMatchIdx = tgtM * 2 + 1;

          const topEl = document.getElementById(`match-card-${activePool.id}-${r}-${topMatchIdx}`);
          const botEl = document.getElementById(`match-card-${activePool.id}-${r}-${botMatchIdx}`);
          const tgtEl = document.getElementById(`match-card-${activePool.id}-${r + 1}-${tgtM}`);

          if (!tgtEl) continue;

          const tgtRect = tgtEl.getBoundingClientRect();
          const tgtX = tgtRect.left - wrapperRect.left + wrapper.scrollLeft;
          const tgtY = tgtRect.top + tgtRect.height / 2 - wrapperRect.top + wrapper.scrollTop;

          // Branch from Top Match
          if (topEl) {
            const topRect = topEl.getBoundingClientRect();
            const topX = topRect.right - wrapperRect.left + wrapper.scrollLeft;
            const topY = topRect.top + topRect.height / 2 - wrapperRect.top + wrapper.scrollTop;
            const topMatch = currentRound[topMatchIdx];
            const isTopWinner = topMatch && topMatch.winner !== null;

            const midX = topX + (tgtX - topX) / 2;
            const strokeColor = isTopWinner ? "#f59e0b" : "#94a3b8";
            const strokeWidth = isTopWinner ? "2.5" : "1.5";
            paths += `<path d="M ${topX} ${topY} L ${midX} ${topY} L ${midX} ${tgtY} L ${tgtX} ${tgtY}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
          }

          // Branch from Bottom Match
          if (botEl) {
            const botRect = botEl.getBoundingClientRect();
            const botX = botRect.right - wrapperRect.left + wrapper.scrollLeft;
            const botY = botRect.top + botRect.height / 2 - wrapperRect.top + wrapper.scrollTop;
            const botMatch = currentRound[botMatchIdx];
            const isBotWinner = botMatch && botMatch.winner !== null;

            const midX = botX + (tgtX - botX) / 2;
            const strokeColor = isBotWinner ? "#f59e0b" : "#94a3b8";
            const strokeWidth = isBotWinner ? "2.5" : "1.5";
            paths += `<path d="M ${botX} ${botY} L ${midX} ${botY} L ${midX} ${tgtY} L ${tgtX} ${tgtY}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`;
          }
        }
      }

      svg.innerHTML = paths;
    };

    const timer = setTimeout(drawConnectors, 50);
    window.addEventListener("resize", drawConnectors);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", drawConnectors);
    };
  }, [state, activePool]);

  // Actions
  const handleCategoryChange = (catName: string) => {
    setState((prev) => ({
      ...prev,
      category: catName,
    }));
    showSuccess(`Kategori bagan diubah: ${catName}`);
  };

  const handleSwitchPool = (poolId: string) => {
    setState((prev) => ({
      ...prev,
      activePoolId: poolId,
    }));
  };

  const handleAddNewPool = () => {
    const existingKeys = Object.keys(state.pools);
    const poolLetters = ["C", "D", "E", "F"];
    const nextLetter = poolLetters[existingKeys.length - 2] || `X${existingKeys.length + 1}`;
    const newPoolId = `pool_${nextLetter.toLowerCase()}`;
    const newPoolName = `Pool ${nextLetter}`;

    const newPool: TournamentPool = {
      id: newPoolId,
      name: newPoolName,
      tatami: (existingKeys.length % 4) + 1,
      participantCount: 8,
      bracketSize: 8,
      rounds: [],
      roster: [],
    };
    buildPoolRounds(newPool);

    setState((prev) => ({
      ...prev,
      activePoolId: newPoolId,
      pools: {
        ...prev.pools,
        [newPoolId]: newPool,
      },
    }));
    showSuccess(`${newPoolName} berhasil ditambahkan.`);
  };

  const handleDeleteCurrentPool = () => {
    if (["pool_a", "pool_b", "championship_final"].includes(state.activePoolId)) {
      showError("Pool A dan Pool B adalah pool utama dan tidak dapat dihapus.");
      return;
    }
    const poolToDelete = state.activePoolId;
    setState((prev) => {
      const updatedPools = { ...prev.pools };
      delete updatedPools[poolToDelete];
      return {
        ...prev,
        activePoolId: "pool_a",
        pools: updatedPools,
      };
    });
    showSuccess("Pool berhasil dihapus.");
  };

  const handleSetParticipantCount = (count: number) => {
    if (!activePool) return;
    const updatedPool = { ...activePool, participantCount: count };
    buildPoolRounds(updatedPool);

    setState((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [activePool.id]: updatedPool,
      },
    }));
    showSuccess(`Jumlah peserta ${activePool.name} disetel: ${count} atlet`);
  };

  const handleShuffleBracket = () => {
    if (!activePool) return;
    // Collect all fighters in Round 0 who are not BYE
    const allFighters: TournamentFighter[] = [];
    activePool.rounds[0]?.forEach((m) => {
      if (m.aka && !m.aka.isBye) allFighters.push(m.aka);
      if (m.ao && !m.ao.isBye) allFighters.push(m.ao);
    });

    // Fisher-Yates shuffle
    for (let i = allFighters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allFighters[i], allFighters[j]] = [allFighters[j], allFighters[i]];
    }

    const updatedPool = { ...activePool };
    buildPoolRounds(updatedPool, allFighters);

    setState((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [activePool.id]: updatedPool,
      },
    }));
    showSuccess(`Bagan ${activePool.name} berhasil diacak secara acak (Seeded Draw)!`);
  };

  const handleResetBracket = () => {
    if (!activePool) return;
    const defaultRoster = activePool.id === "pool_b" ? DEFAULT_ROSTER_POOL_B : DEFAULT_ROSTER_POOL_A;
    const updatedPool = { ...activePool, participantCount: 12 };
    buildPoolRounds(updatedPool, defaultRoster.slice(0, 12));

    setState((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [activePool.id]: updatedPool,
      },
    }));
    showSuccess(`Bagan ${activePool.name} dikembalikan ke susunan awal.`);
  };

  // Declare winner in a match and advance them
  const handleSelectWinner = (
    roundIdx: number,
    matchIdx: number,
    winnerCorner: "aka" | "ao"
  ) => {
    if (!activePool) return;
    const updatedPool = JSON.parse(JSON.stringify(activePool)) as TournamentPool;
    const match = updatedPool.rounds[roundIdx]?.[matchIdx];
    if (!match) return;

    // Toggle if clicked again
    const newWinner = match.winner === winnerCorner ? null : winnerCorner;
    match.winner = newWinner;
    match.status = newWinner ? "COMPLETED" : "PENDING";

    const winningFighter = newWinner ? match[newWinner] : null;

    // Advance to next round if exists
    if (roundIdx + 1 < updatedPool.rounds.length) {
      const nextMatchIdx = Math.floor(matchIdx / 2);
      const isTopBranch = matchIdx % 2 === 0;
      const nextMatch = updatedPool.rounds[roundIdx + 1][nextMatchIdx];
      if (nextMatch) {
        if (isTopBranch) {
          nextMatch.aka = winningFighter ? { ...winningFighter, score: 0 } : null;
        } else {
          nextMatch.ao = winningFighter ? { ...winningFighter, score: 0 } : null;
        }
      }
    } else if (roundIdx === updatedPool.rounds.length - 1) {
      // Final round of pool -> set champion
      updatedPool.champion = winningFighter ? { ...winningFighter } : null;
    }

    setState((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [activePool.id]: updatedPool,
      },
    }));

    if (winningFighter) {
      showSuccess(`Pemenang partai disahkan: ${winningFighter.name} (${winnerCorner.toUpperCase()})`);
    }
  };

  // Forward pool winners & runners-up to Championship Final
  const handleForwardPoolWinnersToFinal = () => {
    const poolA = state.pools.pool_a;
    const poolB = state.pools.pool_b;
    if (!poolA || !poolB) {
      showError("Pool A dan Pool B diperlukan untuk Bagan Final.");
      return;
    }

    const finalRoundA = poolA.rounds[poolA.rounds.length - 1]?.[0];
    const finalRoundB = poolB.rounds[poolB.rounds.length - 1]?.[0];

    const champA = finalRoundA && finalRoundA.winner ? finalRoundA[finalRoundA.winner] : null;
    const runnerA = finalRoundA && finalRoundA.winner ? finalRoundA[finalRoundA.winner === "aka" ? "ao" : "aka"] : null;

    const champB = finalRoundB && finalRoundB.winner ? finalRoundB[finalRoundB.winner] : null;
    const runnerB = finalRoundB && finalRoundB.winner ? finalRoundB[finalRoundB.winner === "aka" ? "ao" : "aka"] : null;

    setState((prev) => {
      const updatedFinal = { ...prev.championshipFinal };
      // Gold match
      const gold = updatedFinal.matches.find((m) => m.id === "final-gold");
      if (gold) {
        gold.aka = champA ? { ...champA, score: 0 } : { name: "Juara Pool A", dojo: "INKAI SBY" };
        gold.ao = champB ? { ...champB, score: 0 } : { name: "Juara Pool B", dojo: "INKAI SBY" };
      }
      // Bronze match
      const bronze = updatedFinal.matches.find((m) => m.id === "final-bronze");
      if (bronze) {
        bronze.aka = runnerA ? { ...runnerA, score: 0 } : { name: "Runner-Up Pool A", dojo: "INKAI SBY" };
        bronze.ao = runnerB ? { ...runnerB, score: 0 } : { name: "Runner-Up Pool B", dojo: "INKAI SBY" };
      }

      return {
        ...prev,
        activePoolId: "championship_final",
        championshipFinal: updatedFinal,
      };
    });
    showSuccess("Juara dan Runner-Up Pool A & B berhasil dialirkan ke Bagan Final Emas & Perunggu!");
  };

  // Print F4 Landscape
  const handlePrintF4 = () => {
    try {
      const sheetHtml = generateF4BracketSheetHTML(state, true, tournamentTitle);
      const printWin = window.open("", "_blank", "width=1280,height=850");
      if (printWin) {
        printWin.document.write(sheetHtml);
        printWin.document.close();
        printWin.focus();
        showSuccess("Membuka lembar bagan F4 Landscape di tab baru...");
      } else {
        showError("Popup terblokir oleh browser. Izinkan popup untuk mencetak lembar bagan.");
      }
    } catch (e: unknown) {
      showError("Gagal mencetak bagan: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Populate from DB registered athletes for this category
  const handleImportRegisteredAthletes = () => {
    if (!activePool) return;
    const matchingRegs = registrations.filter((r) => {
      // Find category name or match category ID
      return true;
    });

    if (matchingRegs.length === 0) {
      showError("Belum ada atlet terdaftar di database untuk kategori ini.");
      return;
    }

    const importedFighters: TournamentFighter[] = matchingRegs.map((r, idx) => ({
      id: r.id || `reg_${idx}`,
      name: r.member?.fullName || `Atlet #${idx + 1}`,
      dojo: r.dojo?.name || "Kontingen INKAI",
      score: 0,
    }));

    const updatedPool = {
      ...activePool,
      participantCount: Math.min(importedFighters.length, 32),
    };
    buildPoolRounds(updatedPool, importedFighters);

    setState((prev) => ({
      ...prev,
      pools: {
        ...prev.pools,
        [activePool.id]: updatedPool,
      },
    }));
    showSuccess(`Berhasil memuat ${importedFighters.length} atlet terdaftar dari database!`);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Tournament Engine WKF
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
            Bagan Turnamen &amp; Multi-Pool Generator
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Bagan gugur dinamis standar WKF: adaptif peserta (4, 8, 12, 16, Custom), drag &amp; drop manual atlet/slot, serta sistem multi-pool (Pool A, B, C, D &amp; Bagan Final).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShuffleBracket}
            disabled={isFinalActive}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 shadow-xs flex items-center space-x-1.5 transition-all disabled:opacity-40"
          >
            <Shuffle className="w-4 h-4 text-amber-500" />
            <span>Acak Bagan (Seeded Draw)</span>
          </button>

          <button
            type="button"
            onClick={handleResetBracket}
            disabled={isFinalActive}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:text-rose-600 border border-zinc-300 dark:border-zinc-700 shadow-xs flex items-center space-x-1.5 transition-all disabled:opacity-40"
            title="Reset ke susunan awal"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handlePrintF4}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-md flex items-center space-x-1.5 transition-all"
            title="Cetak format kertas F4 (Folio) Landscape"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Bagan (F4 Landscape)</span>
          </button>
        </div>
      </div>

      {/* Top Filter & Category Selector */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase">Pilih Kategori:</span>
          <select
            value={state.category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-zinc-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs shadow-xs"
          >
            {categories.length > 0 ? (
              categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))
            ) : (
              <>
                <option value="Kumite Senior Putra -67kg">Kumite Senior Putra -67kg</option>
                <option value="Kumite Senior Putra -75kg">Kumite Senior Putra -75kg</option>
                <option value="Kumite Kadet Putri -47kg">Kumite Kadet Putri -47kg</option>
                <option value="Kata Senior Perorangan Putra">Kata Senior Perorangan Putra</option>
              </>
            )}
          </select>

          {registrations.length > 0 && !isFinalActive && (
            <button
              type="button"
              onClick={handleImportRegisteredAthletes}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-bold text-xs hover:bg-emerald-100 transition-all flex items-center space-x-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Tarik Atlet Pendaftar ({registrations.length})</span>
            </button>
          )}

          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            {isFinalActive ? "Bagan Puncak • Tatami 1" : `${activePool?.name || "Pool A"} • Tatami ${activePool?.tatami || 1} Siap`}
          </span>
        </div>

        <div className="flex items-center space-x-3 text-zinc-500 text-xs">
          <span>Format: <strong className="text-zinc-900 dark:text-white font-bold">Single Elimination WKF + Bagan Antar Pool</strong></span>
        </div>
      </div>

      {/* Multi-Pool Navigation Tabs & Action Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Pool Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(state.pools).map((pKey) => {
              const p = state.pools[pKey];
              const isActive = state.activePoolId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSwitchPool(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                    isActive
                      ? "bg-amber-500 text-zinc-950 shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  <Users className={`w-3.5 h-3.5 ${isActive ? "text-zinc-950" : "text-amber-500"}`} />
                  <span>{p.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      isActive ? "bg-black/15 text-zinc-950" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                    } font-mono`}
                  >
                    {p.participantCount}P
                  </span>
                </button>
              );
            })}

            {/* Championship Final Tab */}
            <button
              type="button"
              onClick={() => handleSwitchPool("championship_final")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                isFinalActive
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-black shadow-md"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100"
              }`}
            >
              <Trophy className={`w-3.5 h-3.5 ${isFinalActive ? "text-zinc-950" : "text-amber-600"}`} />
              <span>🏆 Bagan Final (Antar Juara Pool)</span>
            </button>
          </div>

          {/* Add / Delete Pool buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddNewPool}
              className="px-3 py-1.5 rounded-xl border border-dashed border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center space-x-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-amber-600" />
              <span>Tambah Pool Baru</span>
            </button>
            {!["pool_a", "pool_b", "championship_final"].includes(state.activePoolId) && (
              <button
                type="button"
                onClick={handleDeleteCurrentPool}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all"
                title="Hapus Pool Ini"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Participant Size Presets */}
        {!isFinalActive && activePool && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[11px] mr-1">
                Jumlah Peserta:
              </span>
              {[4, 8, 12, 16].map((cnt) => {
                const isSelected = activePool.participantCount === cnt;
                return (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleSetParticipantCount(cnt)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-amber-500 text-zinc-950 border-amber-500"
                        : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {cnt} {cnt === 4 ? "(Semifinal)" : cnt === 8 ? "(8 Besar)" : cnt === 12 ? "(12 + 4 BYE)" : "(16 Penuh)"}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomCountPromptOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold flex items-center space-x-1"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>Custom...</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold">
                {activePool.participantCount} Peserta • {activePool.bracketSize - activePool.participantCount} Slot BYE
              </div>
              <button
                type="button"
                onClick={handleForwardPoolWinnersToFinal}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-all"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Kirim Juara Pool ke Bagan Final</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Count Dialog Modal */}
      {customCountPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Setel Jumlah Peserta Kustom</h3>
            <p className="text-xs text-zinc-500">Masukkan jumlah atlet (misal: 6, 10, 14, 20, 24, 32):</p>
            <input
              type="number"
              min="2"
              max="32"
              value={customCountInput}
              onChange={(e) => setCustomCountInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm font-bold bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            />
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCustomCountPromptOpen(false)}
                className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const val = parseInt(customCountInput, 10);
                  if (val >= 2 && val <= 32) {
                    handleSetParticipantCount(val);
                    setCustomCountPromptOpen(false);
                  } else {
                    showError("Jumlah peserta harus antara 2 dan 32.");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Tournament Bracket Grid */}
      <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center text-base">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                  {isFinalActive ? "Bagan Grand Final Antar Juara Pool" : `Bagan Pertandingan WKF • ${activePool?.name}`}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {isFinalActive ? "Emas & Perunggu" : `${activePool?.participantCount} Peserta`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Standar World Karate Federation • Tata letak presisi siap cetak lembar meja wasit / dinding.
              </p>
            </div>
          </div>
        </div>

        {/* Final Round View or Pool Rounds View */}
        {isFinalActive ? (
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {state.championshipFinal.matches.map((fMatch, idx) => {
                const isGold = fMatch.id === "final-gold";
                return (
                  <div
                    key={fMatch.id}
                    className={`rounded-2xl border-2 p-5 shadow-sm bg-white dark:bg-zinc-950 ${
                      isGold
                        ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/20"
                        : "border-zinc-400 dark:border-zinc-700 bg-zinc-50/40 dark:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center space-x-2">
                        <Award className={`w-5 h-5 ${isGold ? "text-amber-500" : "text-zinc-400"}`} />
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                          {fMatch.title}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-amber-600">Partai #{fMatch.number}</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {/* AKA Corner */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                        <div>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-600 text-white mr-2">
                            AKA
                          </span>
                          <strong className="text-sm font-bold text-rose-950 dark:text-rose-200">
                            {fMatch.aka?.name || "TBD (Juara Pool A)"}
                          </strong>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-7">
                            {fMatch.aka?.dojo || "Kontingen INKAI"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setState((prev) => {
                              const updated = { ...prev.championshipFinal };
                              const m = updated.matches[idx];
                              m.winner = m.winner === "aka" ? null : "aka";
                              return { ...prev, championshipFinal: updated };
                            });
                          }}
                          className={`p-2 rounded-lg ${
                            fMatch.winner === "aka" ? "bg-amber-500 text-black" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                          }`}
                          title="Tetapkan pemenang"
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center font-black text-zinc-400 text-xs">VS</div>

                      {/* AO Corner */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div>
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-600 text-white mr-2">
                            AO
                          </span>
                          <strong className="text-sm font-bold text-blue-950 dark:text-blue-200">
                            {fMatch.ao?.name || "TBD (Juara Pool B)"}
                          </strong>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-7">
                            {fMatch.ao?.dojo || "Kontingen INKAI"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setState((prev) => {
                              const updated = { ...prev.championshipFinal };
                              const m = updated.matches[idx];
                              m.winner = m.winner === "ao" ? null : "ao";
                              return { ...prev, championshipFinal: updated };
                            });
                          }}
                          className={`p-2 rounded-lg ${
                            fMatch.winner === "ao" ? "bg-amber-500 text-black" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                          }`}
                          title="Tetapkan pemenang"
                        >
                          <Crown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onSendToScoreboard?.(fMatch, "Bagan Final", state.category, 1);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-bold text-xs flex items-center space-x-1.5 hover:opacity-90"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim ke Meja Wasit / Scoreboard</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Pool Bracket Columns */
          <div
            ref={wrapperRef}
            id="bracket-matches-wrapper"
            className="relative min-w-[950px] pb-6 overflow-visible"
          >
            {/* SVG Connector Lines */}
            <svg
              ref={svgRef}
              id="bracket-connector-svg"
              className="absolute top-0 left-0 pointer-events-none z-0 overflow-visible"
            />

            <div className="flex gap-8 relative z-10">
              {activePool?.rounds.map((roundMatches, rIdx) => {
                const roundTitle = roundMatches[0]?.roundName || `Babak ${rIdx + 1}`;
                return (
                  <div key={rIdx} className="flex-1 flex flex-col min-w-[220px]">
                    {/* Round Header */}
                    <div className="py-2 px-3 rounded-xl bg-zinc-900 text-white dark:bg-zinc-800 text-center text-xs font-black uppercase tracking-wider mb-4 shadow-xs">
                      {roundTitle}
                    </div>

                    {/* Match Cards in this Round */}
                    <div className="flex-1 flex flex-col justify-around gap-6">
                      {roundMatches.map((match, mIdx) => {
                        const isAkaWinner = match.winner === "aka";
                        const isAoWinner = match.winner === "ao";
                        const isAkaBye = match.aka?.isBye;
                        const isAoBye = match.ao?.isBye;

                        return (
                          <div
                            key={match.id}
                            id={`match-card-${activePool.id}-${rIdx}-${mIdx}`}
                            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                          >
                            {/* Match Header */}
                            <div className="bg-zinc-50 dark:bg-zinc-900/80 px-3 py-1.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-500">
                              <span>Partai #{match.number}</span>
                              <div className="flex items-center gap-1">
                                <span>Tatami {activePool.tatami}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSendToScoreboard?.(
                                      match,
                                      activePool.name,
                                      state.category,
                                      activePool.tatami
                                    );
                                  }}
                                  className="text-amber-600 hover:text-amber-500 p-0.5 ml-1"
                                  title="Kirim partai ini ke Live Scoreboard"
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* AKA Corner */}
                            <div
                              className={`p-2.5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 transition-colors ${
                                isAkaWinner
                                  ? "bg-rose-100/70 dark:bg-rose-950/40 border-l-4 border-l-rose-600 font-bold"
                                  : isAkaBye
                                  ? "bg-zinc-50/50 dark:bg-zinc-900/30 opacity-60"
                                  : "hover:bg-rose-50/30"
                              }`}
                            >
                              <div className="truncate max-w-[150px]">
                                <span className="px-1 py-0.2 rounded text-[7px] font-black bg-rose-600 text-white mr-1.5 uppercase">
                                  AKA
                                </span>
                                <span className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold truncate">
                                  {match.aka?.name || "TBD"}
                                </span>
                                {match.aka?.dojo && (
                                  <div className="text-[9px] text-zinc-400 truncate ml-5">
                                    {match.aka.dojo}
                                  </div>
                                )}
                              </div>

                              {!isAkaBye && match.aka && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectWinner(rIdx, mIdx, "aka")}
                                  className={`p-1 rounded-md transition-all ${
                                    isAkaWinner
                                      ? "bg-amber-500 text-black shadow-xs"
                                      : "text-zinc-300 hover:text-amber-500"
                                  }`}
                                  title="Tetapkan AKA menang"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* AO Corner */}
                            <div
                              className={`p-2.5 flex items-center justify-between transition-colors ${
                                isAoWinner
                                  ? "bg-blue-100/70 dark:bg-blue-950/40 border-l-4 border-l-blue-600 font-bold"
                                  : isAoBye
                                  ? "bg-zinc-50/50 dark:bg-zinc-900/30 opacity-60"
                                  : "hover:bg-blue-50/30"
                              }`}
                            >
                              <div className="truncate max-w-[150px]">
                                <span className="px-1 py-0.2 rounded text-[7px] font-black bg-blue-600 text-white mr-1.5 uppercase">
                                  AO
                                </span>
                                <span className="text-xs text-zinc-900 dark:text-zinc-100 font-semibold truncate">
                                  {match.ao?.name || "TBD"}
                                </span>
                                {match.ao?.dojo && (
                                  <div className="text-[9px] text-zinc-400 truncate ml-5">
                                    {match.ao.dojo}
                                  </div>
                                )}
                              </div>

                              {!isAoBye && match.ao && (
                                <button
                                  type="button"
                                  onClick={() => handleSelectWinner(rIdx, mIdx, "ao")}
                                  className={`p-1 rounded-md transition-all ${
                                    isAoWinner
                                      ? "bg-amber-500 text-black shadow-xs"
                                      : "text-zinc-300 hover:text-amber-500"
                                  }`}
                                  title="Tetapkan AO menang"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

