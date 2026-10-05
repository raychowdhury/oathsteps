import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/Legal";
import { legalInfo } from "@/server/legal";

export const metadata: Metadata = { title: "Privacy notice" };
// Operator details come from the environment at request time, not from the build.
export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return <PrivacyNotice legal={legalInfo()} />;
}
