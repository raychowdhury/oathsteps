import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="o-shell">
      <div className="o-main">
        <div className="o-page o-narrow" style={{ justifyContent: "center" }}>
          <div className="o-card o-card-amber">
            <div className="o-strong">You’re offline</div>
            <div>This page was not saved for offline use. Practice still works if you downloaded the content in Settings.</div>
            <Link href="/practice" className="o-btn o-btn-s" style={{ alignSelf: "flex-start" }}>
              Go to Practice
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
