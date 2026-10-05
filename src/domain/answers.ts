import { sample, type Rng } from "./rng";

export interface AnswerVariant {
  text: string;
  note?: string;
}

/**
 * Expand official answer wording into comparable variants.
 * "(U.S.) Constitution" → ["us constitution", "constitution"]; parentheses mark optional words.
 */
export function expandVariants(text: string): string[] {
  const results = new Set<string>();
  const walk = (s: string) => {
    const m = /\(([^()]*)\)/.exec(s);
    if (!m) {
      results.add(normalize(s));
      return;
    }
    walk(s.slice(0, m.index) + m[1] + s.slice(m.index + m[0].length));
    walk(s.slice(0, m.index) + s.slice(m.index + m[0].length));
  };
  walk(text);
  results.delete("");
  return [...results];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Typed self-check: does the learner's text match any accepted variant? Used as a hint, never as a grade. */
export function matchesAnyAnswer(input: string, answers: readonly AnswerVariant[]): boolean {
  const n = normalize(input);
  if (!n) return false;
  return answers.some((a) => expandVariants(a.text).some((v) => v === n || (v.length > 3 && n.includes(v))));
}

export interface ChoiceQuestion {
  id: string;
  subsection: string;
  answers: readonly AnswerVariant[];
  dynamic?: unknown;
}

export interface MultipleChoice {
  correct: string;
  options: string[];
}

/**
 * Build a 4-option multiple-choice set. Distractors come from other questions in the same
 * subsection first, then anywhere. Dynamic questions are never offered as MC.
 */
export function buildMultipleChoice(question: ChoiceQuestion, pool: readonly ChoiceQuestion[], rng: Rng): MultipleChoice | null {
  if (question.dynamic || !question.answers.length) return null;
  const correct = question.answers[0].text;
  const own = new Set(question.answers.flatMap((a) => expandVariants(a.text)));
  const candidates = (q: ChoiceQuestion) => q.id !== question.id && !q.dynamic;
  const pick = (qs: ChoiceQuestion[]) =>
    qs
      .flatMap((q) => q.answers.map((a) => a.text))
      .filter((t) => !expandVariants(t).some((v) => own.has(v)))
      .filter((t) => !/answers will vary|testupdates/i.test(t));
  const same = pick(pool.filter((q) => candidates(q) && q.subsection === question.subsection));
  const other = pick(pool.filter((q) => candidates(q) && q.subsection !== question.subsection));
  const distractors: string[] = [];
  for (const d of [...sample(same, 3, rng), ...sample(other, 3, rng)]) {
    if (distractors.length === 3) break;
    if (!distractors.includes(d)) distractors.push(d);
  }
  if (distractors.length < 2) return null;
  return { correct, options: sample([correct, ...distractors], distractors.length + 1, rng) };
}
