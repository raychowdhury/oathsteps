import type { Metadata } from "next";
import { TermsOfUse } from "@/components/Legal";
import { legalInfo } from "@/server/legal";

export const metadata: Metadata = { title: "Terms of use" };
// Operator details come from the environment at request time, not from the build.
export const dynamic = "force-dynamic";

export default function TermsPage() {
  return <TermsOfUse legal={legalInfo()} />;
}
