"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import type { LegalInfo } from "@/server/legal";
import { Screen } from "@/components/Screen";
import { ContactSection, LegalIntro, PrivacySections, TermsSections } from "@/components/LegalText";

function Shell({ title, legal, children }: { title: string; legal: LegalInfo; children: ReactNode }) {
  return (
    <Screen title={title} tab="today" back="/" showTabs={false} showSettings={false}>
      <div className="o-page o-narrow o-legal">
        <LegalIntro title={title} legal={legal} />
        {children}
        <ContactSection legal={legal} />
        <p className="o-meta">
          <Link href="/privacy">Privacy notice</Link> · <Link href="/terms">Terms of use</Link>
        </p>
      </div>
    </Screen>
  );
}

export function PrivacyNotice({ legal }: { legal: LegalInfo }) {
  return (
    <Shell title="Privacy notice" legal={legal}>
      <PrivacySections legal={legal} />
    </Shell>
  );
}

export function TermsOfUse({ legal }: { legal: LegalInfo }) {
  return (
    <Shell title="Terms of use" legal={legal}>
      <TermsSections legal={legal} />
    </Shell>
  );
}
