"use client";

/**
 * Browser speech synthesis and recognition wrappers. Availability is a runtime fact, so every
 * caller gets a status. Recognition uses the browser's own Web Speech API; some browsers send
 * audio to the vendor's service to transcribe it. OathSteps records nothing.
 */
export type SpeechStatus = "unsupported" | "no-voices" | "ready";

export function speechStatus(): SpeechStatus {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return "unsupported";
  return window.speechSynthesis.getVoices().length ? "ready" : "no-voices";
}

let current: string | null = null;
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
export function subscribePlaying(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export function playingText(): string | null {
  return current;
}

/** Speak text with the browser voice. Resolves when done or when it could not play. */
export function speak(text: string, rate = 1): Promise<"spoken" | "unavailable" | "error"> {
  return new Promise((resolve) => {
    if (speechStatus() === "unsupported") return resolve("unavailable");
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = rate;
      const voice = synth.getVoices().find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;
      current = text;
      emit();
      const done = (r: "spoken" | "error") => {
        if (current === text) {
          current = null;
          emit();
        }
        resolve(r);
      };
      u.onend = () => done("spoken");
      u.onerror = () => done("error");
      synth.speak(u);
      setTimeout(() => done("spoken"), Math.min(20000, 2000 + text.length * 120));
    } catch {
      resolve("error");
    }
  });
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  current = null;
  emit();
}

// ---- Recognition ---------------------------------------------------------------------------------
type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export interface RecognitionResult {
  status: "heard" | "nothing" | "denied" | "error";
  transcript: string;
  confidence: number;
}

/** One-shot recognition session. `stop()` ends listening early; the promise resolves with what was heard. */
export function listenOnce(opts: { timeoutMs?: number } = {}): { done: Promise<RecognitionResult>; stop: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { done: Promise.resolve({ status: "error", transcript: "", confidence: 0 }), stop: () => {} };
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  let settled = false;
  let result: RecognitionResult = { status: "nothing", transcript: "", confidence: 0 };
  const done = new Promise<RecognitionResult>((resolve) => {
    const finish = () => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    rec.onresult = (e) => {
      const alt = e.results[0]?.[0];
      if (alt && alt.transcript.trim()) result = { status: "heard", transcript: alt.transcript.trim(), confidence: alt.confidence ?? 0 };
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") result = { status: "denied", transcript: "", confidence: 0 };
      else if (e.error === "no-speech" || e.error === "aborted") result = { status: "nothing", transcript: "", confidence: 0 };
      else result = { status: "error", transcript: "", confidence: 0 };
    };
    rec.onend = finish;
    setTimeout(() => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      finish();
    }, opts.timeoutMs ?? 15000);
  });
  try {
    rec.start();
  } catch {
    result = { status: "error", transcript: "", confidence: 0 };
    settled = true;
  }
  return {
    done,
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
  };
}
