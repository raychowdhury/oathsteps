"use client";
import { useState, useSyncExternalStore } from "react";
import { speak, speechStatus, stopSpeaking, type SpeechStatus } from "@/lib/audio";
import { Button } from "./ui";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener?.("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener?.("voiceschanged", onChange);
}
const serverSnapshot = (): SpeechStatus => "unsupported";

export function SpeakButton({ text, rate = 0.9, label = "Listen" }: { text: string; rate?: number; label?: string }) {
  const status = useSyncExternalStore(subscribe, speechStatus, serverSnapshot);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (status === "unsupported") {
    return (
      <span className="text-sm text-ink-3" role="note">
        Audio is not available in this browser. The text is shown instead.
      </span>
    );
  }

  const onClick = async () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setFailed(false);
    const r = await speak(text, { rate });
    setPlaying(false);
    if (r !== "spoken") setFailed(true);
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={onClick} aria-pressed={playing} aria-label={playing ? `Stop ${label.toLowerCase()}` : label}>
        <span aria-hidden>{playing ? "■" : "▶"}</span> {playing ? "Stop" : label}
      </Button>
      {status === "no-voices" && <span className="text-sm text-ink-3">No English voice found on this device yet.</span>}
      {failed && (
        <span className="text-sm text-warn" role="alert">
          Audio could not play. Read the text instead.
        </span>
      )}
    </span>
  );
}
