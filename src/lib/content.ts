import guideJson from "../../content/guide/stages.json";
import pack2008 from "../../content/packs/civics-2008.json";
import pack2025 from "../../content/packs/civics-2025.json";
import type { Bank } from "@/domain/types";

export interface Answer {
  text: string;
  note?: string;
}
export interface DynamicRule {
  kind: string;
  lookupUrl: string;
  lookupLabel: string;
  scope: "federal" | "state" | "district";
}
export interface Question {
  id: string;
  number: number;
  bank: Bank;
  section: string;
  subsection: string;
  prompt: string;
  answers: Answer[];
  requiredCount: number;
  special: boolean;
  note?: string;
  dynamic?: DynamicRule;
}
export interface ContentPack {
  packId: string;
  bank: Bank;
  title: string;
  appliesWhen: string;
  version: string;
  contentHash: string;
  generatedAt: string;
  rules: { standard: { asked: number; pass: number; stopIncorrect: number }; special: { asked: number; pass: number; stopIncorrect: number } };
  source: { id: string; title: string; url: string; sha256: string; retrievedAt: string };
  review: { machineChecked: boolean; humanReviewed: boolean; note: string };
  questions: Question[];
}
export interface GuideSource {
  label: string;
  url: string;
}
export interface GuideItem {
  id: string;
  text: string;
  why: string;
  sources: GuideSource[];
}
export interface GuideStage {
  id: string;
  title: string;
  milestone: string | null;
  summary: string;
  items: GuideItem[];
}
export interface Guide {
  version: string;
  review: { machineChecked: boolean; humanReviewed: boolean; reviewedAt: string; note: string };
  stages: GuideStage[];
}

const packs: Record<Bank, ContentPack> = {
  "2008": pack2008 as unknown as ContentPack,
  "2025": pack2025 as unknown as ContentPack,
};
export const guide = guideJson as unknown as Guide;

export function getPack(bank: Bank): ContentPack {
  return packs[bank];
}

export function getQuestion(id: string): Question | undefined {
  const bank = id.slice(0, 4) as Bank;
  return packs[bank]?.questions.find((q) => q.id === id);
}

export function questionsFor(bank: Bank, special: boolean): Question[] {
  const qs = packs[bank].questions;
  return special ? qs.filter((q) => q.special) : qs;
}

export interface Topic {
  section: string;
  subsection: string;
  questionIds: string[];
}

export function topicsFor(bank: Bank, special: boolean): Topic[] {
  const out: Topic[] = [];
  for (const q of questionsFor(bank, special)) {
    let t = out.find((x) => x.section === q.section && x.subsection === q.subsection);
    if (!t) {
      t = { section: q.section, subsection: q.subsection, questionIds: [] };
      out.push(t);
    }
    t.questionIds.push(q.id);
  }
  return out;
}

export function allPacks(): ContentPack[] {
  return [packs["2025"], packs["2008"]];
}
