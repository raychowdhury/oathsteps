"use client";
import { useSyncExternalStore } from "react";
import { playingText, speak, speechStatus, stopSpeaking, subscribePlaying, type SpeechStatus } from "@/lib/speech";
import { Icon } from "./icons";
import { useToast } from "./Overlay";

function subscribeVoices(cb: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener?.("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener?.("voiceschanged", cb);
}
const serverStatus = (): SpeechStatus => "unsupported";
const serverPlaying = () => null;

/** "Listen" button from the design: secondary button with the speaker icon; "Playing…" while active. */
export function ListenButton({ text, rate = 1, label = "Listen", ghost = false, ariaLabel, iconOnly = false, style }: { text: string; rate?: number; label?: string; ghost?: boolean; ariaLabel?: string; iconOnly?: boolean; style?: React.CSSProperties }) {
  const { toast } = useToast();
  const status = useSyncExternalStore(subscribeVoices, speechStatus, serverStatus);
  const playing = useSyncExternalStore(subscribePlaying, playingText, serverPlaying);
  const isPlaying = playing === text;
  const onClick = async () => {
    if (isPlaying) return stopSpeaking();
    if (status === "unsupported") return toast("Audio isn’t available in this browser. The words on screen match the audio.");
    const r = await speak(text, rate);
    if (r === "error") toast("Audio couldn’t play. The words on screen match the audio.");
  };
  return (
    <button className={`o-btn ${ghost ? "o-btn-g" : "o-btn-s"}`} type="button" onClick={onClick} aria-label={ariaLabel ?? (iconOnly ? `Listen: ${text}` : undefined)} aria-pressed={isPlaying} style={style}>
      <Icon name="listen" />
      {!iconOnly && (isPlaying ? "Playing…" : label)}
    </button>
  );
}
