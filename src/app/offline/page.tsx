import { LinkButton } from "@/components/ui";

export default function OfflinePage() {
  return (
    <div className="space-y-4 py-8 text-center">
      <h1 className="text-2xl font-bold">You are offline</h1>
      <p className="text-ink-2">This page was not saved for offline use. Practice cards still work if you downloaded the content in Settings.</p>
      <LinkButton href="/practice" variant="secondary">
        Go to Practice
      </LinkButton>
    </div>
  );
}
