"use client";

import React, { useState } from "react";
import { PresentationScene, savePresentationScenes, resetPresentationScenes } from "./presentation-data";
import { X, Save, RotateCcw, Download, Upload, Edit3, Check } from "lucide-react";

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: PresentationScene[];
  onUpdateScenes: (updated: PresentationScene[]) => void;
}

export function PresentationEditorModal({ isOpen, onClose, scenes, onUpdateScenes }: EditorModalProps) {
  const [localScenes, setLocalScenes] = useState<PresentationScene[]>(scenes);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [isSavedToast, setIsSavedToast] = useState(false);

  if (!isOpen) return null;

  const currentScene = localScenes[selectedIdx] || localScenes[0];

  const handleFieldChange = (field: keyof PresentationScene, val: unknown) => {
    const updated = [...localScenes];
    updated[selectedIdx] = {
      ...updated[selectedIdx],
      [field]: val
    };
    setLocalScenes(updated);
  };

  const handlePointsChange = (text: string) => {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    handleFieldChange("points", lines);
  };

  const handleSaveAll = () => {
    savePresentationScenes(localScenes);
    onUpdateScenes(localScenes);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleResetToDefault = () => {
    if (confirm("Apakah Anda yakin ingin mengembalikan naskah dan durasi presentasi ke pengaturan bawaan awal?")) {
      const def = resetPresentationScenes();
      setLocalScenes(def);
      onUpdateScenes(def);
      setSelectedIdx(0);
    }
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localScenes, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `inkai_presentation_scenes_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalScenes(parsed);
          onUpdateScenes(parsed);
          savePresentationScenes(parsed);
          alert("Naskah presentasi berhasil diimpor!");
        } else {
          alert("Format JSON tidak valid!");
        }
      } catch {
        alert("Gagal membaca file JSON!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-red-600 font-bold">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                Editor Naskah & Alur Motion Presentasi
                {isSavedToast && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" /> Tersimpan!
                  </span>
                )}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Sesuaikan judul, naskah pembicara, durasi per adegan, dan poin-poin fitur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportJson}
              className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl border border-slate-300 shadow-sm transition"
              title="Ekspor naskah ke file JSON"
            >
              <Download className="w-4 h-4 text-slate-600" /> Ekspor JSON
            </button>

            <label className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl border border-slate-300 shadow-sm cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-600" /> Impor
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold bg-white hover:bg-red-50 hover:text-red-700 text-slate-600 px-3 py-2 rounded-xl border border-slate-300 shadow-sm transition"
              title="Kembalikan ke naskah bawaan"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Column: Scene Selector */}
          <div className="md:col-span-4 border-r border-slate-200 bg-slate-50 p-4 overflow-y-auto space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1">
              Daftar Adegan ({localScenes.length})
            </div>
            {localScenes.map((sc, i) => (
              <button
                key={sc.id}
                onClick={() => setSelectedIdx(i)}
                className={`w-full text-left p-3 rounded-2xl text-xs sm:text-sm transition border flex items-start gap-3 shadow-sm ${
                  selectedIdx === i
                    ? "bg-red-50 border-red-500 text-slate-900 font-extrabold ring-2 ring-red-100"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 font-black shadow-sm ${
                  selectedIdx === i ? "bg-red-600 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {i + 1}
                </span>
                <div className="truncate flex-1">
                  <div className="truncate text-slate-900 font-bold">{sc.title}</div>
                  <div className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-1">
                    <span className="font-mono font-bold text-red-600">{sc.durationSeconds} dtk</span>
                    <span>·</span>
                    <span className="truncate">{sc.category}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right Column: Form Editor with larger font inputs */}
          <div className="md:col-span-8 p-6 overflow-y-auto space-y-5 bg-white">
            {currentScene ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Judul Adegan</label>
                    <input
                      type="text"
                      value={currentScene.title}
                      onChange={(e) => handleFieldChange("title", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Durasi (Detik)</label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={currentScene.durationSeconds}
                      onChange={(e) => handleFieldChange("durationSeconds", Math.max(5, parseInt(e.target.value) || 10))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm sm:text-base font-bold text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Subjudul / Ringkasan</label>
                    <input
                      type="text"
                      value={currentScene.subtitle}
                      onChange={(e) => handleFieldChange("subtitle", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Label Badge / Tag</label>
                    <input
                      type="text"
                      value={currentScene.badge}
                      onChange={(e) => handleFieldChange("badge", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-red-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Narration Script (Voiceover / Teleprompter) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-800">
                      Naskah Narasi Pembicara (Teleprompter / Voiceover Script)
                    </label>
                    <span className="text-xs text-slate-500">Tampil otomatis di layar saat adegan diputar</span>
                  </div>
                  <textarea
                    rows={4}
                    value={currentScene.narration}
                    onChange={(e) => handleFieldChange("narration", e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-sm sm:text-base text-slate-900 leading-relaxed font-medium focus:outline-none focus:border-red-500 focus:bg-white resize-y"
                    placeholder="Tuliskan naskah yang dibaca pembicara untuk adegan ini..."
                  />
                </div>

                {/* Points List */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs sm:text-sm font-bold text-slate-800">
                      Poin-Poin Fitur Utama (Satu baris per poin)
                    </label>
                    <span className="text-xs font-bold text-red-600 font-mono">{currentScene.points.length} poin</span>
                  </div>
                  <textarea
                    rows={4}
                    value={currentScene.points.join("\n")}
                    onChange={(e) => handlePointsChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-2xl p-4 text-xs sm:text-sm font-mono text-slate-800 leading-relaxed focus:outline-none focus:border-red-500 focus:bg-white resize-y"
                    placeholder="Baris 1&#10;Baris 2&#10;Baris 3..."
                  />
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-sm">Pilih adegan di sebelah kiri untuk mengedit.</div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <div className="text-xs sm:text-sm text-slate-600 font-medium">
            Total Estimasi Waktu Presentasi:{" "}
            <span className="font-black text-slate-900 font-mono">
              {Math.floor(localScenes.reduce((acc, s) => acc + s.durationSeconds, 0) / 60)} m{" "}
              {localScenes.reduce((acc, s) => acc + s.durationSeconds, 0) % 60} dtk
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition"
            >
              Tutup
            </button>
            <button
              onClick={handleSaveAll}
              className="text-xs sm:text-sm font-black px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 shadow-lg shadow-red-200 transition"
            >
              <Save className="w-4 h-4" /> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
