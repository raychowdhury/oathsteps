"use client";

/**
 * Browser speech synthesis wrapper. Availability is a runtime fact, not a promise:
 * voices may be missing, offline, or blocked, so every caller gets a status.
 */
export type SpeechStatus = "unsupported" | "no-voices" | "ready";

export function speechStatus(): SpeechStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return "unsupported";
  const voices = window.speechSynthesis.getVoices();
  return voices.length ? "ready" : "no-voices";
}

export function speak(text: string, opts: { rate?: number; lang?: string } = {}): Promise<"spoken" | "unavailable" | "error"> {
  return new Promise((resolve) => {
    const status = speechStatus();
    if (status === "unsupported") return resolve("unavailable");
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang ?? "en-US";
      u.rate = opts.rate ?? 0.9;
      const voice = synth.getVoices().find((v) => v.lang.startsWith("en")) ?? null;
      if (voice) u.voice = voice;
      u.onend = () => resolve("spoken");
      u.onerror = () => resolve("error");
      synth.speak(u);
      // Some engines never fire onend when muted; resolve after a generous timeout.
      setTimeout(() => resolve("spoken"), Math.min(20000, 2000 + text.length * 120));
    } catch {
      resolve("error");
    }
  });
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
