
export interface WordDiff {
  diffs: number;
  words: { t: string; ok: boolean }[];
}

/**
 * Word-by-word comparison for the writing test. Punctuation and case are ignored, position
 * matters. Extra words typed beyond the sentence count as differences.
 */
export function compareWords(target: string, typed: string): WordDiff {
  const tw = normalizeKeepStops(target).split(" ").filter(Boolean);
  const yw = normalizeKeepStops(typed).split(" ").filter(Boolean);
  const originals = target.split(" ");
  let diffs = 0;
  const words = tw.map((w, i) => {
    const ok = yw[i] === w;
    if (!ok) diffs++;
    return { t: originals[i] ?? w, ok };
  });
  if (yw.length > tw.length) diffs += yw.length - tw.length;
  return { diffs, words };
}

/** Like `normalize` but keeps articles, since the writing test is about the exact sentence. */
function normalizeKeepStops(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function describeDiff(d: WordDiff): string {
  return d.diffs === 0 ? "Matches the sentence" : `${d.diffs} word${d.diffs === 1 ? "" : "s"} different`;
}
