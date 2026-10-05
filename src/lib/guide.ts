import guideJson from "../../content/guide/stages.json";

export interface GuideSource {
  label: string;
  url: string;
}
export interface GuideItem {
  id: string;
  text: string;
  why: string;
  links: string[];
  action?: "filing" | "settings" | "journey";
  actionLabel?: string;
}
export interface GuideStage {
  id: string;
  title: string;
  items: GuideItem[];
}
export interface Guide {
  version: string;
  /** reviewedAt is when the sources were last checked; humanReviewedAt and reviewerCredential are set with humanReviewed (content/review/REVIEW.md). */
  review: { machineChecked: boolean; humanReviewed: boolean; reviewedAt: string; humanReviewedAt?: string; reviewerCredential?: string; note: string };
  sources: Record<string, GuideSource>;
  stages: GuideStage[];
}

export const guide = guideJson as unknown as Guide;

export const allGuideItems: GuideItem[] = guide.stages.flatMap((s) => s.items);

export function guideItem(id: string): GuideItem | undefined {
  return allGuideItems.find((i) => i.id === id);
}

export function sourceFor(key: string): GuideSource | undefined {
  return guide.sources[key];
}
