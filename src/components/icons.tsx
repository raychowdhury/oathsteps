/** Line icons from the design: 24px grid, 1.75 stroke, round caps. Always paired with a text label or aria-label. */
const PATHS = {
  logo: "M4 19h4.5v-4.5H13V10h4.5V5.5H20",
  today: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  practice: "M7 3.5h11.5a2 2 0 0 1 2 2V17",
  interview: "M20.5 12a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z",
  journey: "M3 20h5v-5h5v-5h5V5h3",
  mic: "M5 11a7 7 0 0 0 14 0M12 18v3",
  micOff: "M3 3l18 18M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.4M19 11a7 7 0 0 1-.3 2M12 18v3",
  save: "M6 3h12v18l-6-4-6 4z",
  guide: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13",
  offline: "M3 3l18 18M8.5 6.6A5 5 0 0 1 17 9h1a4 4 0 0 1 2.4 7.2M17 18H7a4 4 0 0 1-1.3-7.8",
  check: "M5 12.5l4.5 4.5L19 7.5",
  again: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  flag: "M5 21V4h11l-2 4 2 4H5",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  back: "M15 18l-6-6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  person: "M4 21a8 8 0 0 1 16 0",
  calendar: "M3 10h18M8 3v4M16 3v4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 15V4M7 9l5-5 5 5M5 20h14",
  listen: "M4 9v6h4l5 4V5L8 9H4z",
  listenWaves: "M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  listenWave: "M16.5 8.5a5 5 0 0 1 0 7",
  pencil: "M4 20h4L19 9l-4-4L4 16v4z",
  info: "M12 11v5M12 8h.01",
  warn: "M12 3l9.5 17h-19zM12 10v4M12 17h.01",
  lock: "M8 10V7a4 4 0 0 1 8 0v3",
  clock: "M12 7v5l3 2",
  bars: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  stop: "",
  question: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.3M12 17h.01",
  doc: "M7 3h10v18H7zM10 7h4M10 11h4M10 15h2",
  note: "M12 8v5M12 16h.01",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, small = false, className = "", style }: { name: IconName; small?: boolean; className?: string; style?: React.CSSProperties }) {
  const extra =
    name === "today" ? <circle cx="12" cy="12" r="4" /> :
    name === "practice" ? <rect x="3" y="7" width="13" height="13" rx="2" /> :
    name === "mic" ? <rect x="9" y="3" width="6" height="11" rx="3" /> :
    name === "person" ? <circle cx="12" cy="8" r="4" /> :
    name === "calendar" ? <rect x="3" y="5" width="18" height="16" rx="2" /> :
    name === "info" ? <circle cx="12" cy="12" r="9" /> :
    name === "lock" ? <rect x="5" y="10" width="14" height="11" rx="2" /> :
    name === "clock" ? <circle cx="12" cy="12" r="9" /> :
    name === "stop" ? <rect x="6" y="6" width="12" height="12" rx="2" /> :
    name === "listen" ? <path d="M16.5 8.5a5 5 0 0 1 0 7" /> :
    null;
  return (
    <svg className={`o-i ${small ? "o-i-s" : ""} ${className}`} viewBox="0 0 24 24" aria-hidden="true" style={style}>
      {extra}
      {PATHS[name] && <path d={PATHS[name]} />}
    </svg>
  );
}
