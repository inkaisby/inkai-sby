"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Maximize,
  Minimize,
  ArrowRightLeft,
  Volume2,
  VolumeX,
  Trophy,
  Crown,
  Sparkles,
} from "lucide-react";
import { ScoreboardState } from "@/lib/tournament-bracket-types";
import { playWkfHorn, playStadiumChime } from "@/lib/tournament-audio";

function ScoreboardViewer() {
  const searchParams = useSearchParams();
  const initialTatami = parseInt(searchParams.get("tatami") || "1", 10);
  const isOverlayMode = searchParams.get("overlay") === "1";

  const [tatami, setTatami] = useState<number>(initialTatami);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const hideToolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<ScoreboardState>({
    tatami: initialTatami,
    category: "Kumite Senior Putra -67kg",
    matchTitle: "Partai #101 • Kumite Perorangan",
    roundName: "Babak 16 Besar",
    mode: "kumite",
    aka: {
      name: "BINTANG KSATRIA AJI",
      dojo: "Dojo Macan Putih",
      score: 0,
      senshu: false,
      penalties: 0,
    },
    ao: {
      name: "FACHRUL ANAM",
      dojo: "Dojo Rajawali Surabaya",
      score: 0,
      senshu: false,
      penalties: 0,
    },
    timerRemainingMs: 180 * 1000,
    timerDurationSec: 180,
    isTimerRunning: false,
    isLayoutSwapped: false,
    winner: null,
  });

  const [winnerCelebration, setWinnerCelebration] = useState<{
    corner: "aka" | "ao";
    name: string;
    dojo: string;
    scoreAka: number;
    scoreAo: number;
    title: string;
  } | null>(null);

  // Auto-hide floating toolbar after 3s of mouse inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setIsToolbarVisible(true);
      if (hideToolbarTimeoutRef.current) {
        clearTimeout(hideToolbarTimeoutRef.current);
      }
      hideToolbarTimeoutRef.current = setTimeout(() => {
        setIsToolbarVisible(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideToolbarTimeoutRef.current) clearTimeout(hideToolbarTimeoutRef.current);
    };
  }, []);

  // Sync engine: BroadcastChannel + localStorage
  useEffect(() => {
    const channelName = `inkai_tatami_${tatami}`;
    let broadcastChannel: BroadcastChannel | null = null;

    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      broadcastChannel = new BroadcastChannel(channelName);
      broadcastChannel.onmessage = (event) => {
        const payload = event.data;
        if (!payload) return;

        if (payload.type === "STATE_UPDATE" || payload.type === "SYNC_ALL") {
          setState(payload.data);
          if (payload.data.winner) {
            setWinnerCelebration(payload.data.winner);
          }
        } else if (payload.type === "TRIGGER_HORN") {
          if (!isAudioMuted) {
            playWkfHorn(payload.duration || 1.2, payload.freq || 520);
          }
        } else if (payload.type === "DECLARE_WINNER") {
          setWinnerCelebration(payload.data);
          if (!isAudioMuted) {
            playStadiumChime();
          }
        } else if (payload.type === "DISMISS_WINNER") {
          setWinnerCelebration(null);
        }
      };

      // Request latest state
      broadcastChannel.postMessage({ type: "REQUEST_CURRENT_STATE", tatami });
    }

    // LocalStorage fallback check
    try {
      const saved = localStorage.getItem(`inkai_sync_tatami_${tatami}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(parsed);
        if (parsed.winner) setWinnerCelebration(parsed.winner);
      }
    } catch {
      // ignore
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `inkai_sync_tatami_${tatami}` && e.newValue) {
        try {
          setState(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
      if (e.key === `inkai_winner_event_${tatami}`) {
        if (e.newValue) {
          try {
            setWinnerCelebration(JSON.parse(e.newValue));
          } catch {
            // ignore
          }
        } else {
          setWinnerCelebration(null);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      broadcastChannel?.close();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [tatami, isAudioMuted]);

  // Fullscreen controls
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyX") {
        setState((prev) => ({ ...prev, isLayoutSwapped: !prev.isLayoutSwapped }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    <div
      className={`min-h-screen w-screen flex flex-col justify-between relative selection:bg-amber-400 selection:text-black overflow-hidden ${
        isOverlayMode ? "bg-transparent" : "bg-[#020617] text-white"
      }`}
    >
      {/* FLOATING SUBTLE TOOLBAR */}
      <aside
        aria-label="Scoreboard Controls"
        className={`fixed top-4 right-4 z-50 flex items-center space-x-2 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-2xl transition-all ${
          isToolbarVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="flex items-center space-x-1.5 px-2 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-emerald-400 font-bold">SYNC LIVE</span>
        </div>

        {/* Tatami Switcher */}
        <select
          value={tatami}
          onChange={(e) => setTatami(parseInt(e.target.value, 10))}
          className="bg-slate-950 border border-slate-700 text-amber-400 rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none"
        >
          <option value="1">Matras 1</option>
          <option value="2">Matras 2 (Arena Utama)</option>
          <option value="3">Matras 3</option>
          <option value="4">Matras 4</option>
        </select>

        {/* Swap Sides */}
        <button
          type="button"
          onClick={() => setState((prev) => ({ ...prev, isLayoutSwapped: !prev.isLayoutSwapped }))}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-amber-400 border border-slate-700 text-xs font-bold transition-all"
          title="Tukar Sisi AO & AKA (Shortcut: X)"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>

        {/* Mute Audio */}
        <button
          type="button"
          onClick={() => setIsAudioMuted(!isAudioMuted)}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-amber-400 border border-slate-700 text-xs font-bold transition-all"
          title="Mute / Unmute Suara Sirine"
        >
          {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-amber-400 border border-slate-700 text-xs font-bold transition-all"
          title="Toggle Layar Penuh (Shortcut: F)"
        >
          {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* TOP HEADER */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md z-10">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-md">
            INKAI
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-wider uppercase text-white">
              KEJUARAAN KOTA INKAI SURABAYA 2026
            </h1>
            <p className="text-xs text-amber-400 font-bold font-mono">
              TATAMI {tatami} • ARENA RESMI WKF
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="px-3.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-amber-400 font-black text-xs sm:text-sm tracking-wider uppercase">
            {state.matchTitle}
          </span>
          <p className="text-[11px] text-zinc-400 mt-1">{state.category} ({state.roundName})</p>
        </div>
      </header>

      {/* MAIN ARENA DISPLAY (AO vs AKA) */}
      <main className="flex-1 flex flex-col justify-center px-4 sm:px-8 py-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch max-w-7xl mx-auto w-full">
          {/* Left Fighter */}
          <div
            className={`lg:col-span-4 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-4 shadow-2xl relative overflow-hidden ${
              leftCorner === "aka"
                ? "bg-rose-950/60 border-rose-600 shadow-rose-900/30"
                : "bg-blue-950/60 border-blue-600 shadow-blue-900/30"
            }`}
          >
            {/* Header info */}
            <div className="flex items-center justify-between">
              <span
                className={`px-4 py-1.5 rounded-xl font-black text-sm tracking-widest uppercase shadow-md ${
                  leftCorner === "aka" ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                }`}
              >
                {leftCorner.toUpperCase()}
              </span>

              {state[leftCorner].senshu && (
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs tracking-wider shadow-lg animate-bounce">
                  ★ SENSHU
                </span>
              )}
            </div>

            {/* Giant Score Display */}
            <div className="py-6 text-center">
              <span
                className={`text-8xl sm:text-9xl md:text-[140px] font-mono font-black tracking-tighter block drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] ${
                  leftCorner === "aka" ? "text-rose-400" : "text-blue-400"
                }`}
              >
                {state[leftCorner].score}
              </span>
            </div>

            {/* Fighter Details */}
            <div className="space-y-3">
              <div className="border-t border-slate-700/80 pt-3">
                <h2 className="text-xl sm:text-2xl font-black uppercase text-white truncate drop-shadow-sm">
                  {state[leftCorner].name}
                </h2>
                <p className="text-sm font-semibold text-zinc-300 truncate">{state[leftCorner].dojo}</p>
              </div>

              {/* Penalties Row */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                  PENALTI:
                </span>
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const isActive = state[leftCorner].penalties >= lvl;
                  const label = lvl === 4 ? "HC" : lvl === 5 ? "H" : `C${lvl}`;
                  return (
                    <span
                      key={lvl}
                      className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                        isActive
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-900/80 text-zinc-600 border border-slate-800"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Central Timer Box */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 space-y-6">
            <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase font-bold">
              OFFICIAL WKF MATCH TIMER
            </span>

            {/* Mega Countdown */}
            <div className="py-4">
              <div
                className={`text-7xl sm:text-8xl md:text-9xl font-mono font-black tracking-tight text-center drop-shadow-2xl ${
                  isFinishedTimer
                    ? "text-amber-400 animate-pulse"
                    : isDangerTimer
                    ? "text-rose-500 animate-pulse"
                    : "text-white"
                }`}
              >
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                <span className="text-3xl sm:text-4xl text-zinc-500 font-normal">.{tenths}</span>
              </div>
            </div>

            <div className="text-center">
              <span className="px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono font-bold text-zinc-400">
                {state.isTimerRunning ? "🟢 PERTANDINGAN BERJALAN" : "⏸️ TIMER BERHENTI (YAME)"}
              </span>
            </div>
          </div>

          {/* Right Fighter */}
          <div
            className={`lg:col-span-4 rounded-3xl p-6 sm:p-8 flex flex-col justify-between border-4 shadow-2xl relative overflow-hidden ${
              rightCorner === "aka"
                ? "bg-rose-950/60 border-rose-600 shadow-rose-900/30"
                : "bg-blue-950/60 border-blue-600 shadow-blue-900/30"
            }`}
          >
            {/* Header info */}
            <div className="flex items-center justify-between">
              <span
                className={`px-4 py-1.5 rounded-xl font-black text-sm tracking-widest uppercase shadow-md ${
                  rightCorner === "aka" ? "bg-rose-600 text-white" : "bg-blue-600 text-white"
                }`}
              >
                {rightCorner.toUpperCase()}
              </span>

              {state[rightCorner].senshu && (
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs tracking-wider shadow-lg animate-bounce">
                  ★ SENSHU
                </span>
              )}
            </div>

            {/* Giant Score Display */}
            <div className="py-6 text-center">
              <span
                className={`text-8xl sm:text-9xl md:text-[140px] font-mono font-black tracking-tighter block drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] ${
                  rightCorner === "aka" ? "text-rose-400" : "text-blue-400"
                }`}
              >
                {state[rightCorner].score}
              </span>
            </div>

            {/* Fighter Details */}
            <div className="space-y-3">
              <div className="border-t border-slate-700/80 pt-3">
                <h2 className="text-xl sm:text-2xl font-black uppercase text-white truncate drop-shadow-sm">
                  {state[rightCorner].name}
                </h2>
                <p className="text-sm font-semibold text-zinc-300 truncate">{state[rightCorner].dojo}</p>
              </div>

              {/* Penalties Row */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mr-1">
                  PENALTI:
                </span>
                {[1, 2, 3, 4, 5].map((lvl) => {
                  const isActive = state[rightCorner].penalties >= lvl;
                  const label = lvl === 4 ? "HC" : lvl === 5 ? "H" : `C${lvl}`;
                  return (
                    <span
                      key={lvl}
                      className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                        isActive
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-900/80 text-zinc-600 border border-slate-800"
                      }`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER TICKER */}
      <footer className="w-full px-6 py-2 border-t border-slate-900 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-zinc-500 z-10">
        <span>INKAI CABANG SURABAYA • DEWAN WASIT & JURI WKF</span>
        <span>KOMITE PERTANDINGAN &amp; BRACKET ENGINE REAL-TIME</span>
      </footer>

      {/* FULLSCREEN WINNER CELEBRATION MODAL */}
      {winnerCelebration && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-2xl w-full rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border-4 border-amber-400 p-8 text-center space-y-6 shadow-[0_0_80px_rgba(245,158,11,0.4)]">
            <div className="w-20 h-20 rounded-full bg-amber-400 text-slate-950 mx-auto flex items-center justify-center shadow-2xl">
              <Trophy className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <span className="px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest">
                PEMENANG DISAHKAN (WINNER)
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 uppercase">
                {winnerCelebration.name}
              </h2>
              <p className="text-base text-amber-400 font-bold mt-1">{winnerCelebration.dojo}</p>
            </div>

            <div className="flex items-center justify-center space-x-6 py-2">
              <div className="text-center">
                <span className="text-xs font-bold text-rose-400 uppercase">AKA</span>
                <span className="text-4xl font-black font-mono block text-white">
                  {winnerCelebration.scoreAka}
                </span>
              </div>
              <span className="text-2xl font-black text-zinc-600">-</span>
              <div className="text-center">
                <span className="text-xs font-bold text-blue-400 uppercase">AO</span>
                <span className="text-4xl font-black font-mono block text-white">
                  {winnerCelebration.scoreAo}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWinnerCelebration(null)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              Kembali ke Layar Scoreboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoreboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center font-mono">
          Memuat Layar Scoreboard Tatami WKF...
        </div>
      }
    >
      <ScoreboardViewer />
    </Suspense>
  );
}

