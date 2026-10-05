import { resolveTestPath, type TestPath } from "@/domain/testPath";
import type { StudyProfile } from "@/domain/types";
import { questionsFor, type Question } from "./content";

/** The learner's resolved path plus the questions it covers. */
export function pathFor(profile: StudyProfile): TestPath {
  return resolveTestPath({ filingDate: profile.filingDate, provisionalBank: profile.provisionalBank, specialConsideration: profile.specialConsideration });
}

export function bankQuestions(path: TestPath): Question[] {
  return path.bank ? questionsFor(path.bank, path.special) : [];
}

export function bankLabel(path: TestPath): string {
  if (!path.bank) return "Test version not set";
  const base = path.bank === "2008" ? "2008 civics test · 100 questions" : "2025 civics test · 128 questions";
  const special = path.special ? " · 65/20 (20 questions)" : "";
  const prov = path.status === "provisional" ? " · provisional" : "";
  return base + special + prov;
}
