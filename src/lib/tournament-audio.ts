/**
 * Web Audio API Synthesizer & Speech Announcer for Karate WKF Tournament
 * 100% Client-side synthetic audio - no external mp3 assets required.
 */

// Synthesize WKF Horn / Buzzer (Sawtooth wave with resonant drop)
export function playWkfHorn(duration = 1.2, freq = 520) {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.setValueAtTime(freq * 0.5, ctx.currentTime + duration * 0.4);

    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Autoplay policy fallback
  }
}

// Synthesize Stadium Chime / Bell (Two-tone crystal chime)
export function playStadiumChime(callback?: () => void) {
  if (typeof window === "undefined") {
    callback?.();
    return;
  }
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      callback?.();
      return;
    }
    const ctx = new AudioCtx();
    const tones = [587.33, 880.0]; // D5, A5
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.22 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.22);
      osc.stop(ctx.currentTime + idx * 0.22 + 0.6);
    });

    if (callback) {
      setTimeout(callback, 500);
    }
  } catch {
    callback?.();
  }
}

// Synthesize Tatami Whistle (Short crisp high pitch)
export function playTatamiWhistle() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(2400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {
    // Autoplay fallback
  }
}

// Voice Announcer for Calling Athletes to Tatami
export function speakAthleteCall(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }

  playStadiumChime(() => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(
        (v) => v.lang === "id-ID" || v.lang.startsWith("id") || v.name.toLowerCase().includes("indonesia")
      );
      if (idVoice) utterance.voice = idVoice;

      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      onEnd?.();
    }
  });
}

