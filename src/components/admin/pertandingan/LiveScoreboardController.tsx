"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  ExternalLink,
  Video,
  ArrowRightLeft,
  Users,
  Megaphone,
  Trophy,
  Award,
  Crown,
  Bell,
  CheckCircle,
  AlertTriangle,
  Radio,
  Sliders,
} from "lucide-react";
import { ScoreboardState, TournamentMatch } from "@/lib/tournament-bracket-types";
import {
  playWkfHorn,
  playStadiumChime,
  playTatamiWhistle,
  speakAthleteCall,
} from "@/lib/tournament-audio";
import { showSuccess, showError } from "@/lib/client-toast";

interface LiveScoreboardControllerProps {
  initialTatami?: number;
  initialMatch?: TournamentMatch | null;
  initialCategory?: string;
  initialPoolName?: string;
  onMatchFinished?: (result: {
    matchId?: string;
    winner: "aka" | "ao";
    scoreAka: number;
    scoreAo: number;
  }) => void;
}

export function LiveScoreboardController({
  initialTatami = 1,
  initialMatch = null,
  initialCategory = "Kumite Senior Putra -67kg",
  initialPoolName = "Pool A",
  onMatchFinished,
}: LiveScoreboardControllerProps) {
  const [tatami, setTatami] = useState<number>(initialTatami);
  const [state, setState] = useState<ScoreboardState>(() => {
    return {
      tatami: initialTatami,
      category: initialCategory,
      matchTitle: initialMatch ? `Partai #${initialMatch.number}` : "Partai #101 • Kumite Perorangan",
      roundName: initialMatch ? initialMatch.roundName : "Babak 16 Besar",
      currentMatchId: initialMatch?.id || null,
      mode: "kumite",
      aka: {
        name: initialMatch?.aka?.name || "BINTANG KSATRIA AJI",
        dojo: initialMatch?.aka?.dojo || "Dojo Macan Putih",
        score: initialMatch?.aka?.score || 0,
        senshu: false,
        penalties: 0,
      },
      ao: {
        name: initialMatch?.ao?.name || "FACHRUL ANAM",
        dojo: initialMatch?.ao?.dojo || "Dojo Rajawali Surabaya",
        score: initialMatch?.ao?.score || 0,
        senshu: false,
        penalties: 0,
      },
      timerRemainingMs: 180 * 1000,
      timerDurationSec: 180,
      isTimerRunning: false,
      isLayoutSwapped: false,
      winner: null,
    };
  });

  const [announcerModalOpen, setAnnouncerModalOpen] = useState(false);
  const [announcerTarget, setAnnouncerTarget] = useState<"aka" | "ao" | "both">("both");
  const [announcerLevel, setAnnouncerLevel] = useState<number>(1);
  const [customTimerModalOpen, setCustomTimerModalOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(3);
  const [customSeconds, setCustomSeconds] = useState(0);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel & sync with spectator screen
  useEffect(() => {
    const channelName = `inkai_tatami_${tatami}`;
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(channelName);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "REQUEST_CURRENT_STATE") {
          channel.postMessage({
            type: "STATE_UPDATE",
            data: state,
          });
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [tatami, state]);

  // Sync state broadcast helper
  const broadcastCurrentState = useCallback((newState: ScoreboardState) => {
    try {
      localStorage.setItem(`inkai_sync_tatami_${newState.tatami}`, JSON.stringify(newState));
      broadcastChannelRef.current?.postMessage({
        type: "STATE_UPDATE",
        data: newState,
      });
    } catch {
      // ignore
    }
  }, []);

  // Update when props change
  useEffect(() => {
    if (initialMatch) {
      setState((prev) => {
        const next = {
          ...prev,
          tatami: initialTatami,
          category: initialCategory,
          matchTitle: `Partai #${initialMatch.number} • ${initialPoolName}`,
          roundName: initialMatch.roundName,
          currentMatchId: initialMatch.id,
          aka: {
            ...prev.aka,
            name: initialMatch.aka?.name || "Peserta AKA",
            dojo: initialMatch.aka?.dojo || "Kontingen INKAI",
            score: initialMatch.aka?.score || 0,
            senshu: false,
            penalties: 0,
          },
          ao: {
            ...prev.ao,
            name: initialMatch.ao?.name || "Peserta AO",
            dojo: initialMatch.ao?.dojo || "Kontingen INKAI",
            score: initialMatch.ao?.score || 0,
            senshu: false,
            penalties: 0,
          },
          winner: null,
        };
        broadcastCurrentState(next);
        return next;
      });
      showSuccess(`Partai #${initialMatch.number} (${initialMatch.roundName}) berhasil dimuat ke Meja Wasit!`);
    }
  }, [initialMatch, initialCategory, initialPoolName, initialTatami, broadcastCurrentState]);

  // High precision timer loop
  useEffect(() => {
    if (state.isTimerRunning) {
      lastTickRef.current = performance.now();
      timerIntervalRef.current = setInterval(() => {
        const now = performance.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;

        setState((prev) => {
          const nextRemaining = Math.max(0, prev.timerRemainingMs - delta);
          if (nextRemaining === 0 && prev.timerRemainingMs > 0) {
            playWkfHorn(1.5, 480);
            showSuccess("Waktu Kumite Selesai! (SOREMADE / YAME)");
          }

          const nextState: ScoreboardState = {
            ...prev,
            timerRemainingMs: nextRemaining,
            isTimerRunning: nextRemaining > 0,
          };
          broadcastCurrentState(nextState);
          return nextState;
        });
      }, 50);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [state.isTimerRunning, broadcastCurrentState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggleTimer();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        resetTimer();
      } else if (e.code === "KeyX") {
        e.preventDefault();
        toggleLayoutSwap();
      } else if (e.code === "KeyW") {
        e.preventDefault();
        swapAthletesData();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Timer controls
  const toggleTimer = () => {
    setState((prev) => {
      const next = {
        ...prev,
        isTimerRunning: !prev.isTimerRunning,
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  const resetTimer = () => {
    setState((prev) => {
      const next = {
        ...prev,
        isTimerRunning: false,
        timerRemainingMs: prev.timerDurationSec * 1000,
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  const setDuration = (seconds: number) => {
    setState((prev) => {
      const next = {
        ...prev,
        isTimerRunning: false,
        timerDurationSec: seconds,
        timerRemainingMs: seconds * 1000,
      };
      broadcastCurrentState(next);
      return next;
    });
    showSuccess(`Durasi pertandingan disetel: ${Math.floor(seconds / 60)} Menit ${seconds % 60 ? seconds % 60 + " Detik" : ""}`);
  };

  const adjustTimer = (deltaSec: number) => {
    setState((prev) => {
      const nextRemaining = Math.max(0, prev.timerRemainingMs + deltaSec * 1000);
      const next = {
        ...prev,
        timerRemainingMs: nextRemaining,
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  // Scoring controls
  const addScore = (corner: "aka" | "ao", points: number) => {
    setState((prev) => {
      const otherCorner = corner === "aka" ? "ao" : "aka";
      const currentCornerScore = prev[corner].score + points;
      const otherCornerScore = prev[otherCorner].score;

      // Auto senshu if first uncontested score
      let senshuCorner = prev[corner].senshu;
      let senshuOther = prev[otherCorner].senshu;
      if (!senshuCorner && !senshuOther && otherCornerScore === 0) {
        senshuCorner = true;
        showSuccess(`Senshu (Poin Pertama WKF) otomatis untuk sudut ${corner.toUpperCase()}!`);
      }

      // Mercy rule: 8 points gap
      if (Math.abs(currentCornerScore - otherCornerScore) >= 8) {
        playWkfHorn(1.0, 520);
        showSuccess(`Selisih 8 Poin WKF terpenuhi! Sudut ${corner.toUpperCase()} unggul mutlak.`);
      }

      const next: ScoreboardState = {
        ...prev,
        [corner]: {
          ...prev[corner],
          score: currentCornerScore,
          senshu: senshuCorner,
        },
        [otherCorner]: {
          ...prev[otherCorner],
          senshu: senshuOther,
        },
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  const decrementScore = (corner: "aka" | "ao") => {
    setState((prev) => {
      const nextScore = Math.max(0, prev[corner].score - 1);
      const next: ScoreboardState = {
        ...prev,
        [corner]: {
          ...prev[corner],
          score: nextScore,
        },
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  const toggleSenshu = (corner: "aka" | "ao") => {
    setState((prev) => {
      const currentVal = prev[corner].senshu;
      const otherCorner = corner === "aka" ? "ao" : "aka";
      const next: ScoreboardState = {
        ...prev,
        [corner]: {
          ...prev[corner],
          senshu: !currentVal,
        },
        [otherCorner]: {
          ...prev[otherCorner],
          senshu: !currentVal ? false : prev[otherCorner].senshu,
        },
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  const setPenalty = (corner: "aka" | "ao", level: number) => {
    setState((prev) => {
      const nextVal = prev[corner].penalties === level ? level - 1 : level;
      if (nextVal >= 5) {
        playWkfHorn(1.5, 400);
        showError(`HANSOKU (Diskualifikasi) untuk sudut ${corner.toUpperCase()}!`);
      }
      const next: ScoreboardState = {
        ...prev,
        [corner]: {
          ...prev[corner],
          penalties: nextVal,
        },
      };
      broadcastCurrentState(next);
      return next;
    });
  };

  // Layout & Athlete actions
  const toggleLayoutSwap = () => {
    setState((prev) => {
      const next: ScoreboardState = {
        ...prev,
        isLayoutSwapped: !prev.isLayoutSwapped,
      };
      broadcastCurrentState(next);
      return next;
    });
    showSuccess("Posisi sudut di layar ditukar (Shortcut: X)");
  };

  const swapAthletesData = () => {
    setState((prev) => {
      const next: ScoreboardState = {
        ...prev,
        aka: { ...prev.ao },
        ao: { ...prev.aka },
      };
      broadcastCurrentState(next);
      return next;
    });
    showSuccess("Data atlet AKA dan AO berhasil ditukar (Shortcut: W)");
  };

  // Sound triggers
  const handleTriggerHorn = () => {
    playWkfHorn(1.2, 520);
    broadcastChannelRef.current?.postMessage({
      type: "TRIGGER_HORN",
      duration: 1.2,
      freq: 520,
    });
    showSuccess("Sirine WKF dibunyikan di semua layar penonton.");
  };

  // Confirm winner
  const handleDeclareWinner = (corner: "aka" | "ao") => {
    const winnerData = {
      corner,
      name: state[corner].name,
      dojo: state[corner].dojo,
      scoreAka: state.aka.score,
      scoreAo: state.ao.score,
      title: `${corner.toUpperCase()} (${state[corner].name}) DINYATAKAN MENANG!`,
    };

    setState((prev) => {
      const next: ScoreboardState = {
        ...prev,
        isTimerRunning: false,
        winner: winnerData,
      };
      broadcastCurrentState(next);
      return next;
    });

    playStadiumChime();

    // Broadcast winner celebration event
    try {
      localStorage.setItem(`inkai_winner_event_${tatami}`, JSON.stringify(winnerData));
      broadcastChannelRef.current?.postMessage({
        type: "DECLARE_WINNER",
        data: winnerData,
      });
    } catch {
      // ignore
    }

    onMatchFinished?.({
      matchId: state.currentMatchId || undefined,
      winner: corner,
      scoreAka: state.aka.score,
      scoreAo: state.ao.score,
    });

    showSuccess(`🏆 Pemenang ${corner.toUpperCase()} (${state[corner].name}) berhasil disahkan!`);
  };

  const handleDismissWinner = () => {
    setState((prev) => {
      const next = { ...prev, winner: null };
      broadcastCurrentState(next);
      return next;
    });
    try {
      localStorage.removeItem(`inkai_winner_event_${tatami}`);
      broadcastChannelRef.current?.postMessage({ type: "DISMISS_WINNER" });
    } catch {
      // ignore
    }
  };

  // Announcer
  const handleAnnounceAthlete = () => {
    const levelNames = ["Panggilan Pertama", "Panggilan Kedua", "Panggilan Terakhir"];
    const callPrefix = levelNames[announcerLevel - 1] || "Panggilan";

    let speechText = "";
    if (announcerTarget === "aka") {
      speechText = `${callPrefix}. Diberitahukan kepada sudut merah, ${state.aka.name} dari ${state.aka.dojo}, harap segera memasuki Tatami ${tatami}.`;
    } else if (announcerTarget === "ao") {
      speechText = `${callPrefix}. Diberitahukan kepada sudut biru, ${state.ao.name} dari ${state.ao.dojo}, harap segera memasuki Tatami ${tatami}.`;
    } else {
      speechText = `${callPrefix}. Diberitahukan kepada partai ${state.matchTitle}. Sudut merah ${state.aka.name} dan sudut biru ${state.ao.name}, harap segera memasuki Tatami ${tatami}.`;
    }

    speakAthleteCall(speechText, () => {
      setAnnouncerModalOpen(false);
    });

    showSuccess(`Mengumandangkan pemanggilan atlet di Tatami ${tatami}...`);
  };

  // Open spectator screen popup
  const openSpectatorScreen = () => {
    const width = 1280;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      `/admin/pertandingan/scoreboard?tatami=${tatami}`,
      `scoreboard_tatami_${tatami}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );
  };

  const copyObsLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const obsUrl = `${origin}/admin/pertandingan/scoreboard?tatami=${tatami}&overlay=1`;
    navigator.clipboard.writeText(obsUrl);
    showSuccess("URL OBS Studio Browser Source berhasil disalin!");
  };

  // Format timer
  const totalSeconds = Math.floor(state.timerRemainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((state.timerRemainingMs % 1000) / 100);
  const isDangerTimer = totalSeconds <= 15 && totalSeconds > 0;
  const isFinishedTimer = totalSeconds === 0;

  // Ordering based on swapped layout
  const leftCorner = state.isLayoutSwapped ? "aka" : "ao";
  const rightCorner = state.isLayoutSwapped ? "ao" : "aka";

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
              Panel Operator Wasit Juri
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
            Live Scoreboard &amp; Screen Controller
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pengendali skor digital tatami resmi World Karate Federation (WKF Kumite 3:00 Menit).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tatami Selector */}
          <select
            value={tatami}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setTatami(val);
              setState((prev) => ({ ...prev, tatami: val }));
            }}
            className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 shadow-xs focus:ring-2 focus:ring-amber-500"
          >
            <option value="1">Matras 1</option>
            <option value="2">Matras 2 (Arena Utama)</option>
            <option value="3">Matras 3</option>
            <option value="4">Matras 4</option>
          </select>

          {/* Spectator Window */}
          <button
            type="button"
            onClick={openSpectatorScreen}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md flex items-center space-x-1.5 transition-all"
            title="Buka Layar Bersih Penonton di Monitor Eksternal"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Layar Penonton</span>
          </button>

          {/* Swap Layout */}
          <button
            type="button"
            onClick={toggleLayoutSwap}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            title="Tukar Posisi Layar AO & AKA (Shortcut: X)"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
            <span>{state.isLayoutSwapped ? "Sisi: AKA | AO" : "Sisi: AO | AKA"}</span>
          </button>

          {/* Swap Athletes */}
          <button
            type="button"
            onClick={swapAthletesData}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            title="Tukar Atlet & Data Sudut (Shortcut: W)"
          >
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span>Tukar Atlet</span>
          </button>

          {/* OBS Link */}
          <button
            type="button"
            onClick={copyObsLink}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            title="Salin URL Browser Source OBS Studio"
          >
            <Video className="w-3.5 h-3.5 text-rose-500" />
            <span className="hidden sm:inline">Link OBS</span>
          </button>

          {/* Horn */}
          <button
            type="button"
            onClick={handleTriggerHorn}
            className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-all"
            title="Bunyikan Sirine WKF"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Horn</span>
          </button>

          {/* Announcer */}
          <button
            type="button"
            onClick={() => setAnnouncerModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 text-xs font-black shadow-md flex items-center space-x-1.5 transition-all"
            title="Panggil Atlet Bersuara WKF"
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Panggil Atlet</span>
          </button>
        </div>
      </div>

      {/* Main Scoreboard Display Box */}
      <div className="rounded-3xl bg-slate-950 border-4 border-slate-800 p-5 sm:p-7 shadow-2xl text-white space-y-6 relative overflow-hidden">
        {/* Banner Top */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-slate-800 pb-3 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-mono text-zinc-400 uppercase tracking-widest text-[11px] font-bold">
              TATAMI {tatami} • <span className="text-amber-400">{state.category}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 font-bold font-mono text-[11px] tracking-wider">
              {state.matchTitle} ({state.roundName})
            </span>
          </div>
        </div>

        {/* Winner Celebration Banner */}
        {state.winner && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-2 border-amber-400 flex items-center justify-between animate-pulse">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <div>
                <span className="text-amber-400 font-black text-xs uppercase tracking-wider block">
                  HASIL RESMI PERTANDINGAN
                </span>
                <span className="text-white text-base sm:text-lg font-black">{state.winner.title}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissWinner}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-amber-400 hover:text-white border border-amber-400/40 text-xs font-bold"
            >
              Tutup Banner
            </button>
          </div>
        )}

        {/* Central Display: [LEFT CORNER] - [TIMER] - [RIGHT CORNER] */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Fighter */}
          <div
            className={`lg:col-span-4 p-5 rounded-3xl border-2 flex flex-col justify-between space-y-4 ${
              leftCorner === "aka"
                ? "bg-rose-950/40 border-rose-600/60 text-rose-100"
                : "bg-blue-950/40 border-blue-600/60 text-blue-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  leftCorner === "aka" ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                }`}
              >
                {leftCorner.toUpperCase()}
              </span>

              {/* Senshu Button */}
              <button
                type="button"
                onClick={() => toggleSenshu(leftCorner)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                  state[leftCorner].senshu
                    ? "bg-amber-400 text-black border-amber-300 shadow-sm"
                    : "bg-slate-900/60 text-zinc-400 border-slate-700 hover:text-white"
                }`}
              >
                SENSHU
              </button>
            </div>

            {/* Fighter Info */}
            <div>
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white truncate">
                {state[leftCorner].name}
              </h3>
              <p className="text-xs text-zinc-400 truncate">{state[leftCorner].dojo}</p>
            </div>

            {/* Giant Score Digit */}
            <div className="text-center py-2">
              <span
                className={`text-7xl sm:text-8xl font-black font-mono tracking-tighter ${
                  leftCorner === "aka" ? "text-rose-500" : "text-blue-500"
                }`}
              >
                {state[leftCorner].score}
              </span>
            </div>

            {/* Point Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => addScore(leftCorner, 1)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +1 Yuko
              </button>
              <button
                type="button"
                onClick={() => addScore(leftCorner, 2)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +2 Waza
              </button>
              <button
                type="button"
                onClick={() => addScore(leftCorner, 3)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +3 Ippon
              </button>
              <button
                type="button"
                onClick={() => decrementScore(leftCorner)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 text-xs font-black text-rose-400 transition-all"
                title="Kurangi poin (-1)"
              >
                <Minus className="w-3.5 h-3.5 mx-auto" />
              </button>
            </div>

            {/* Penalties Selector */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5 font-bold">
                <span>HUKUMAN PENALTI WKF:</span>
                <span className="text-amber-400">
                  {state[leftCorner].penalties === 0
                    ? "Bersih"
                    : state[leftCorner].penalties >= 5
                    ? "HANSOKU"
                    : `C${state[leftCorner].penalties}`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-[9px] font-black">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const isActive = state[leftCorner].penalties >= lvl;
                  const label = lvl === 4 ? "HC" : lvl === 5 ? "H" : `C${lvl}`;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPenalty(leftCorner, lvl)}
                      className={`py-1 rounded-md transition-all ${
                        isActive
                          ? "bg-rose-600 text-white font-black"
                          : "bg-slate-900 text-zinc-500 border border-slate-800"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Declare Winner Button */}
            <button
              type="button"
              onClick={() => handleDeclareWinner(leftCorner)}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Sahkan {leftCorner.toUpperCase()} Menang</span>
            </button>
          </div>

          {/* Central Match Timer */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center space-y-4 py-2">
            <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
              WAKTU PERTANDINGAN KUMITE
            </span>

            {/* Giant Countdown Clock */}
            <div className="relative">
              <div
                className={`text-6xl sm:text-7xl font-mono font-black tracking-tight text-center ${
                  isFinishedTimer
                    ? "text-amber-400 animate-pulse"
                    : isDangerTimer
                    ? "text-rose-500 animate-pulse"
                    : "text-white"
                }`}
              >
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                <span className="text-2xl text-zinc-500">.{tenths}</span>
              </div>
            </div>

            {/* Main Timer Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={toggleTimer}
                className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center space-x-2 shadow-lg transition-all ${
                  state.isTimerRunning
                    ? "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {state.isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{state.isTimerRunning ? "PAUSE" : "START"}</span>
              </button>

              <button
                type="button"
                onClick={resetTimer}
                className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-zinc-300 hover:text-white transition-all"
                title="Reset Waktu (Shortcut: R)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={handleTriggerHorn}
                className="p-3 rounded-2xl bg-slate-900 hover:bg-rose-950 border border-slate-700 text-rose-400 hover:text-rose-300 transition-all"
                title="Bunyikan Sirine"
              >
                <Bell className="w-5 h-5" />
              </button>
            </div>

            {/* +10s / -10s adjustments */}
            <div className="flex items-center space-x-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => adjustTimer(-10)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-zinc-400 hover:text-white"
              >
                -10s
              </button>
              <button
                type="button"
                onClick={() => adjustTimer(+10)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-zinc-400 hover:text-white"
              >
                +10s
              </button>
            </div>

            {/* Preset Durations */}
            <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-800 text-[11px] font-bold">
              {[180, 120, 90].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setDuration(sec)}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    state.timerDurationSec === sec
                      ? "bg-amber-400 text-zinc-950 font-black shadow-xs"
                      : "bg-slate-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  {sec / 60}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTimerModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-zinc-400 hover:text-white"
                title="Durasi Kustom"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Fighter */}
          <div
            className={`lg:col-span-4 p-5 rounded-3xl border-2 flex flex-col justify-between space-y-4 ${
              rightCorner === "aka"
                ? "bg-rose-950/40 border-rose-600/60 text-rose-100"
                : "bg-blue-950/40 border-blue-600/60 text-blue-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                  rightCorner === "aka" ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                }`}
              >
                {rightCorner.toUpperCase()}
              </span>

              {/* Senshu Button */}
              <button
                type="button"
                onClick={() => toggleSenshu(rightCorner)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                  state[rightCorner].senshu
                    ? "bg-amber-400 text-black border-amber-300 shadow-sm"
                    : "bg-slate-900/60 text-zinc-400 border-slate-700 hover:text-white"
                }`}
              >
                SENSHU
              </button>
            </div>

            {/* Fighter Info */}
            <div>
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white truncate">
                {state[rightCorner].name}
              </h3>
              <p className="text-xs text-zinc-400 truncate">{state[rightCorner].dojo}</p>
            </div>

            {/* Giant Score Digit */}
            <div className="text-center py-2">
              <span
                className={`text-7xl sm:text-8xl font-black font-mono tracking-tighter ${
                  rightCorner === "aka" ? "text-rose-500" : "text-blue-500"
                }`}
              >
                {state[rightCorner].score}
              </span>
            </div>

            {/* Point Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => addScore(rightCorner, 1)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +1 Yuko
              </button>
              <button
                type="button"
                onClick={() => addScore(rightCorner, 2)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +2 Waza
              </button>
              <button
                type="button"
                onClick={() => addScore(rightCorner, 3)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-black text-white hover:text-amber-400 transition-all"
              >
                +3 Ippon
              </button>
              <button
                type="button"
                onClick={() => decrementScore(rightCorner)}
                className="py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-700 text-xs font-black text-rose-400 transition-all"
                title="Kurangi poin (-1)"
              >
                <Minus className="w-3.5 h-3.5 mx-auto" />
              </button>
            </div>

            {/* Penalties Selector */}
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1.5 font-bold">
                <span>HUKUMAN PENALTI WKF:</span>
                <span className="text-amber-400">
                  {state[rightCorner].penalties === 0
                    ? "Bersih"
                    : state[rightCorner].penalties >= 5
                    ? "HANSOKU"
                    : `C${state[rightCorner].penalties}`}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-[9px] font-black">
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const isActive = state[rightCorner].penalties >= lvl;
                  const label = lvl === 4 ? "HC" : lvl === 5 ? "H" : `C${lvl}`;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPenalty(rightCorner, lvl)}
                      className={`py-1 rounded-md transition-all ${
                        isActive
                          ? "bg-rose-600 text-white font-black"
                          : "bg-slate-900 text-zinc-500 border border-slate-800"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Declare Winner Button */}
            <button
              type="button"
              onClick={() => handleDeclareWinner(rightCorner)}
              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>Sahkan {rightCorner.toUpperCase()} Menang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Announcer Voice Modal */}
      {announcerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                Launcher Pemanggilan Atlet Bersuara WKF
              </h3>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pengumuman resmi pemanggilan atlet ke Tatami menggunakan Text-to-Speech bahasa Indonesia standar pertandingan.
            </p>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">Target Pemanggilan:</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setAnnouncerTarget("both")}
                  className={`py-2 rounded-xl border ${
                    announcerTarget === "both"
                      ? "bg-amber-500 text-zinc-950 border-amber-500"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  Kedua Atlet
                </button>
                <button
                  type="button"
                  onClick={() => setAnnouncerTarget("aka")}
                  className={`py-2 rounded-xl border ${
                    announcerTarget === "aka"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  Sudut AKA (Merah)
                </button>
                <button
                  type="button"
                  onClick={() => setAnnouncerTarget("ao")}
                  className={`py-2 rounded-xl border ${
                    announcerTarget === "ao"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  }`}
                >
                  Sudut AO (Biru)
                </button>
              </div>

              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block pt-2">Tingkat Panggilan:</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAnnouncerLevel(lvl)}
                    className={`py-2 rounded-xl border ${
                      announcerLevel === lvl
                        ? "bg-amber-500 text-zinc-950 border-amber-500"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    Panggilan Ke-{lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setAnnouncerModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAnnounceAthlete}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center space-x-1.5 shadow-md"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>Kumandangkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Timer Modal */}
      {customTimerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Setel Durasi Waktu Kustom</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-zinc-500 block mb-1">Menit:</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
              </div>
              <div>
                <label className="text-zinc-500 block mb-1">Detik:</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customSeconds}
                  onChange={(e) => setCustomSeconds(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 border rounded-xl font-bold bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs font-bold pt-2">
              <button
                type="button"
                onClick={() => setCustomTimerModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const sec = customMinutes * 60 + customSeconds;
                  if (sec > 0) {
                    setDuration(sec);
                    setCustomTimerModalOpen(false);
                  } else {
                    showError("Durasi waktu harus lebih dari 0 detik.");
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
    </div>
  );
}

