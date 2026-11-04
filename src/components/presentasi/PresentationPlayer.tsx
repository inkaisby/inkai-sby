"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PresentationScene, loadPresentationScenes } from "./presentation-data";
import { sfx } from "./audio-effects";
import { PresentationEditorModal } from "./PresentationEditorModal";
import { PresentationHandoutModal } from "./PresentationHandoutModal";

// Scene Visual Components
import { SceneUrlTyping } from "./scenes/SceneUrlTyping";
import { SceneAuthFlow } from "./scenes/SceneAuthFlow";
import { SceneRbacHierarchy } from "./scenes/SceneRbacHierarchy";
import { SceneMemberPortal } from "./scenes/SceneMemberPortal";
import { SceneAdminMembers } from "./scenes/SceneAdminMembers";
import { SceneUktLatber } from "./scenes/SceneUktLatber";
import { SceneTournamentWasit } from "./scenes/SceneTournamentWasit";
import { SceneKasSekretariat } from "./scenes/SceneKasSekretariat";
import { SceneOutroContact } from "./scenes/SceneOutroContact";

import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Edit3,
  FileText,
  Sparkles,
  Keyboard,
  Sun,
  Moon,
  X,
  Printer,
  ExternalLink,
  Clock
} from "lucide-react";

export function PresentationPlayer() {
  const [scenes, setScenes] = useState<PresentationScene[]>(() => loadPresentationScenes());
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [elapsedSceneTime, setElapsedSceneTime] = useState(0); // in seconds
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showTeleprompter, setShowTeleprompter] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHandoutOpen, setIsHandoutOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelpKeyboard, setShowHelpKeyboard] = useState(false);

  // Theme Mode: Default ke Mode Cerah (Light Mode)
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const containerRef = useRef<HTMLDivElement>(null);

  const isLight = theme === "light";
  const currentScene = scenes[currentSceneIndex] || scenes[0];
  const totalScenes = scenes.length;

  // Total duration of presentation in seconds
  const totalDuration = scenes.reduce((acc, s) => acc + s.durationSeconds, 0);

  // Calculate current global presentation elapsed seconds
  const currentGlobalElapsed = scenes.slice(0, currentSceneIndex).reduce((acc, s) => acc + s.durationSeconds, 0) + elapsedSceneTime;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Next Scene
  const handleNextScene = useCallback(() => {
    if (currentSceneIndex < totalScenes - 1) {
      setCurrentSceneIndex((prev) => prev + 1);
      setElapsedSceneTime(0);
      sfx.playSceneTransition();
    } else {
      setIsPlaying(false);
    }
  }, [currentSceneIndex, totalScenes]);

  // Prev Scene
  const handlePrevScene = useCallback(() => {
    if (currentSceneIndex > 0) {
      setCurrentSceneIndex((prev) => prev - 1);
      setElapsedSceneTime(0);
      sfx.playSceneTransition();
    } else {
      setElapsedSceneTime(0);
    }
  }, [currentSceneIndex]);

  // Jump to specific scene
  const handleSelectScene = (idx: number) => {
    if (idx >= 0 && idx < totalScenes) {
      setCurrentSceneIndex(idx);
      setElapsedSceneTime(0);
      sfx.playSceneTransition();
    }
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    sfx.playClick();
    setIsPlaying((prev) => !prev);
  };

  // Restart
  const handleRestart = () => {
    sfx.playGong();
    setCurrentSceneIndex(0);
    setElapsedSceneTime(0);
    setIsPlaying(true);
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    sfx.playClick();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Toggle Mute Audio FX
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      sfx.setEnabled(!next);
      return next;
    });
  }, []);

  // Toggle Theme (Cerah / Gelap)
  const handleToggleTheme = () => {
    sfx.playClick();
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Main Timer Tick (Auto-play loop)
  useEffect(() => {
    if (!isPlaying || !currentScene) return;

    const intervalTimeMs = 100;
    const interval = setInterval(() => {
      setElapsedSceneTime((prev) => {
        const nextTime = prev + (intervalTimeMs / 1000) * playbackSpeed;
        if (nextTime >= currentScene.durationSeconds) {
          handleNextScene();
          return 0;
        }
        return nextTime;
      });
    }, intervalTimeMs);

    return () => clearInterval(interval);
  }, [isPlaying, currentScene, playbackSpeed, handleNextScene]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditorOpen || isHandoutOpen) return;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNextScene();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevScene();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setIsEditorOpen(true);
      } else if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setIsHandoutOpen((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        handleToggleTheme();
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowTeleprompter((prev) => !prev);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRestart();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorOpen, isHandoutOpen, isPlaying, currentSceneIndex, totalScenes, handleNextScene, handlePrevScene, handleToggleMute]);

  // Current Scene Progress (0 to 1)
  const currentSceneProgress = currentScene ? Math.min(1, elapsedSceneTime / currentScene.durationSeconds) : 0;

  // Render Scene Visual component with isLight prop
  const renderSceneVisual = () => {
    if (!currentScene) return null;
    switch (currentScene.visualType) {
      case "url-typing":
        return <SceneUrlTyping scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "auth-flow":
        return <SceneAuthFlow scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "rbac-hierarchy":
        return <SceneRbacHierarchy scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "member-portal":
        return <SceneMemberPortal scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "admin-members":
        return <SceneAdminMembers scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "ukt-latber":
        return <SceneUktLatber scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "tournament-wasit":
        return <SceneTournamentWasit scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "kas-sekretariat":
        return <SceneKasSekretariat scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
      case "outro-contact":
      default:
        return <SceneOutroContact scene={currentScene} progress={currentSceneProgress} isLight={isLight} />;
    }
  };

  if (!currentScene) {
    return (
      <div className={`w-full h-screen flex items-center justify-center ${isLight ? "bg-slate-50 text-slate-800" : "bg-black text-white"}`}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-base font-bold text-slate-600">Memuat presentasi...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-screen flex flex-col justify-between overflow-hidden relative select-none font-sans transition-colors duration-300 ${
        isLight ? "bg-slate-100 text-slate-900" : "bg-zinc-950 text-white"
      }`}
    >
      {/* 1. TOPBAR: Branding, Theme Toggle, Scene Navigator & Toolbar */}
      <header className={`h-16 px-4 sm:px-8 flex items-center justify-between z-30 backdrop-blur-md shrink-0 border-b shadow-sm ${
        isLight
          ? "bg-white/95 border-slate-200 shadow-slate-100 text-slate-800"
          : "bg-zinc-950/90 border-zinc-800/80 text-white"
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-red-200">
              IK
            </div>
            <div>
              <div className="text-sm font-black tracking-wider text-red-600">INKAI SURABAYA</div>
              <div className="text-xs text-slate-500 font-bold font-mono">Motion Presentation</div>
            </div>
          </div>

          <div className={`hidden xl:flex items-center gap-2 ml-4 text-sm font-medium ${isLight ? "text-slate-600" : "text-zinc-400"}`}>
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <span className="font-extrabold text-slate-800">{currentScene.badge}</span>
            <span>:</span>
            <span className="truncate max-w-sm">{currentScene.title}</span>
          </div>
        </div>

        {/* Scene Navigation Dots / Pills */}
        <div className="hidden md:flex items-center gap-2">
          {scenes.map((sc, i) => (
            <button
              key={sc.id}
              onClick={() => handleSelectScene(i)}
              className={`h-9 px-3.5 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all flex items-center gap-1.5 ${
                currentSceneIndex === i
                  ? "bg-red-600 text-white shadow-md shadow-red-200 scale-105"
                  : isLight
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
              title={`Adegan ${i + 1}: ${sc.title}`}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle (Mode Cerah / Gelap) */}
          <button
            onClick={handleToggleTheme}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border shadow-sm transition ${
              isLight
                ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
                : "bg-zinc-900 border-zinc-800 text-amber-300 hover:bg-zinc-800"
            }`}
            title="Ganti Mode Cerah / Gelap (Hotkey: T)"
          >
            {isLight ? <Sun className="w-4 h-4 text-amber-600" /> : <Moon className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">{isLight ? "Mode Cerah" : "Mode Gelap"}</span>
          </button>

          {/* Teleprompter Toggle */}
          <button
            onClick={() => setShowTeleprompter((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border transition ${
              showTeleprompter
                ? isLight
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-red-950/50 border-red-700/60 text-red-300"
                : isLight
                  ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Tampilkan / Sembunyikan Teleprompter Naskah Pembicara (N)"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Naskah</span>
          </button>

          {/* Handout Print Modal Button */}
          <button
            onClick={() => setIsHandoutOpen(true)}
            className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 border transition ${
              isLight
                ? "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300"
            }`}
            title="Cetak Dokumen Handout / Simpan PDF (P)"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span className="hidden sm:inline">Handout</span>
          </button>

          {/* Edit Mode Button */}
          <button
            onClick={() => setIsEditorOpen(true)}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 border shadow-sm transition ${
              isLight
                ? "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
                : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300"
            }`}
            title="Kustomisasi & Edit Naskah / Durasi Adegan (E)"
          >
            <Edit3 className="w-4 h-4 text-red-600" />
            <span className="hidden sm:inline text-red-600">Mode Edit</span>
          </button>

          {/* Buka Portal inkai-sby ↗ */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition"
            title="Buka Website Portal Utama inkai-sby di tab baru"
          >
            <span>Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Keyboard shortcut help */}
          <button
            onClick={() => setShowHelpKeyboard((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition ${
              isLight ? "bg-white border-slate-300 text-slate-600 hover:bg-slate-50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Bantuan Pintasan Keyboard"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={handleToggleFullscreen}
            className={`p-2.5 rounded-xl border transition ${
              isLight ? "bg-white border-slate-300 text-slate-600 hover:bg-slate-50" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Layar Penuh (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN STAGE: Motion Scene Presentation Canvas */}
      <main className="flex-1 w-full min-h-0 relative flex flex-col justify-center items-center p-2 sm:p-3 overflow-hidden">
        <div className={`w-full flex-1 min-h-0 max-w-7xl mx-auto flex flex-col rounded-3xl overflow-hidden shadow-2xl border transition-all duration-300 ${
          isLight ? "bg-white border-slate-200" : "bg-zinc-950 border-zinc-800"
        }`}>
          {renderSceneVisual()}
        </div>

        {/* Dedicated Teleprompter Dock (Diletakkan di bawah slide, TIDAK LAGI MENUTUPI SLIDE) */}
        {showTeleprompter && (
          <div className="w-full max-w-7xl mx-auto pt-2 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className={`rounded-2xl p-3 sm:p-4 border shadow-md flex items-start gap-3.5 transition-all ${
              isLight
                ? "bg-white/95 border-red-300 shadow-red-50 text-slate-900"
                : "bg-zinc-900/95 border-zinc-700 shadow-xl text-zinc-100"
            }`}>
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                isLight ? "bg-red-50 text-red-600" : "bg-zinc-800 text-red-400"
              }`}>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-black tracking-wider text-red-600">
                    TELEPROMPTER · PANDUAN NARASI PEMBICARA
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-red-600" /> Sisa {Math.max(0, Math.ceil(currentScene.durationSeconds - elapsedSceneTime))}s
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">·</span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      Adegan {currentSceneIndex + 1}/{totalScenes} ({Math.round(currentSceneProgress * 100)}%)
                    </span>
                    <button
                      onClick={() => setShowTeleprompter(false)}
                      className={`p-1 rounded-lg transition ${
                        isLight ? "hover:bg-slate-100 text-slate-400 hover:text-slate-700" : "hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                      }`}
                      title="Sembunyikan Teleprompter (N)"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm sm:text-base font-semibold leading-relaxed max-h-24 sm:max-h-28 overflow-y-auto pr-1 text-slate-800">
                  &quot;{currentScene.narration}&quot;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Overlay Modal */}
        {showHelpKeyboard && (
          <div className="absolute inset-0 bg-black/70 z-40 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowHelpKeyboard(false)}>
            <div className={`border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl ${
              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-zinc-900 border-zinc-700 text-white"
            }`} onClick={(e) => e.stopPropagation()}>
              <h4 className="text-base font-black flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-red-600" /> Pintasan Keyboard Pemutar
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Putar / Jeda</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">Spasi</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Ganti Mode Cerah</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">T</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Adegan Berikutnya</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">➔</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Adegan Sebelumnya</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">⬅</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Layar Penuh</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">F</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Mode Edit</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">E</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Teleprompter</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">N</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Mulai Ulang</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">R</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Cetak Handout PDF</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">P</kbd>
                </div>
                <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Bisukan Suara</span>
                  <kbd className="bg-white border border-slate-300 px-2 py-0.5 rounded font-mono font-bold shadow-sm">M</kbd>
                </div>
              </div>
              <button
                onClick={() => setShowHelpKeyboard(false)}
                className="w-full text-center text-sm py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold transition shadow-md shadow-red-200"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. BOTTOMBAR: Timeline Scrubber & Playback Controls */}
      <footer className={`h-20 px-4 sm:px-8 flex flex-col justify-center z-30 backdrop-blur-md shrink-0 border-t ${
        isLight
          ? "bg-white/95 border-slate-200 shadow-lg text-slate-800"
          : "bg-zinc-950/95 border-zinc-800 text-white"
      }`}>
        {/* Timeline Scrubber Bar */}
        <div className="w-full flex items-center gap-4">
          <span className="text-xs sm:text-sm font-mono font-bold text-slate-600 w-14 text-right">
            {formatTime(currentGlobalElapsed)}
          </span>

          {/* Segmented Timeline Progress */}
          <div className={`flex-1 flex gap-1.5 h-3 rounded-full overflow-hidden p-0.5 ${
            isLight ? "bg-slate-200" : "bg-zinc-900"
          }`}>
            {scenes.map((sc, i) => {
              const isPast = i < currentSceneIndex;
              const isCurrent = i === currentSceneIndex;
              return (
                <div
                  key={sc.id}
                  onClick={() => handleSelectScene(i)}
                  className={`h-full rounded-full flex-1 relative overflow-hidden cursor-pointer hover:opacity-80 transition ${
                    isLight ? "bg-slate-300" : "bg-zinc-800"
                  }`}
                  title={`Adegan ${i + 1}: ${sc.title}`}
                >
                  {isPast && <div className="w-full h-full bg-red-600" />}
                  {isCurrent && (
                    <div
                      className="h-full bg-red-600 transition-all duration-100"
                      style={{ width: `${currentSceneProgress * 100}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <span className="text-xs sm:text-sm font-mono font-bold text-slate-400 w-14">
            {formatTime(totalDuration)}
          </span>
        </div>

        {/* Media Control Buttons */}
        <div className="flex items-center justify-between pt-2">
          {/* Left: Speed selector & sound */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-xl border transition ${
                isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
              }`}
              title="Aktifkan / Bisukan Nada Audio FX (M)"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-red-600" />}
            </button>

            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs sm:text-sm font-bold ${
              isLight ? "bg-slate-100 border-slate-300 text-slate-700" : "bg-zinc-900 border-zinc-800 text-zinc-300"
            }`}>
              <span className="text-slate-500">Speed:</span>
              {[1, 1.25, 1.5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded-lg font-mono transition ${
                    playbackSpeed === spd
                      ? "bg-red-600 text-white font-bold shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Center: Main Playback Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevScene}
              disabled={currentSceneIndex === 0}
              className={`p-2.5 rounded-xl border transition disabled:opacity-30 disabled:pointer-events-none ${
                isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              }`}
              title="Adegan Sebelumnya (Panah Kiri)"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={handleTogglePlay}
              className="w-11 h-11 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-200 transition transform active:scale-95"
              title={isPlaying ? "Jeda (Spasi)" : "Putar (Spasi)"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={handleNextScene}
              disabled={currentSceneIndex === totalScenes - 1}
              className={`p-2.5 rounded-xl border transition disabled:opacity-30 disabled:pointer-events-none ${
                isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              }`}
              title="Adegan Berikutnya (Panah Kanan)"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <button
              onClick={handleRestart}
              className={`p-2.5 rounded-xl border transition ${
                isLight ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200" : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white"
              }`}
              title="Ulangi dari Awal (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Scene Category Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500">
            <span>Kategori:</span>
            <span className="font-bold text-slate-800">{currentScene.category}</span>
          </div>
        </div>
      </footer>

      {/* Editor Modal */}
      <PresentationEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        scenes={scenes}
        onUpdateScenes={(updated) => {
          setScenes(updated);
          if (currentSceneIndex >= updated.length) {
            setCurrentSceneIndex(0);
          }
        }}
      />

      {/* Handout Modal */}
      <PresentationHandoutModal
        isOpen={isHandoutOpen}
        onClose={() => setIsHandoutOpen(false)}
        scenes={scenes}
      />
    </div>
  );
}
