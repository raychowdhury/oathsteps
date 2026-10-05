/**
 * Renders the reviewer packet as a printable PDF (HTML to PDF with the Chromium that Playwright already installs).
 * Called by review-packet.ts. A reviewer can print it, mark it up by hand, or annotate it on screen.
 */
import { chromium } from "@playwright/test";

type Ans = { text: string; note?: string };
export interface PdfQuestion {
  id: string;
  number: number;
  section: string;
  subsection: string;
  prompt: string;
  answers: Ans[];
  requiredCount: number;
  special: boolean;
  dynamic?: { lookupUrl: string };
}
export interface PdfInput {
  date: string;
  refs: { scope: string; label: string; ref: string }[];
  packs: { bank: string; title: string; version: string; questions: PdfQuestion[] }[];
  guide: { version: string; stages: { title: string; items: { id: string; text: string; why: string; links?: string[] }[] }[]; sources: Record<string, { label: string; url: string }> };
  english: { version: string; reading: { id: string; text: string }[]; writing: { id: string; text: string }[]; instructions: { id: string; text: string; meaning: string }[]; vocabulary: { id: string; term: string; meaning: string }[]; conversation: { id: string; prompt: string; tip: string }[] };
  routes: { label: string; text: string }[];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const box = '<span class="box"></span>';
const ok = `<td class="chk">${box} Y &nbsp;${box} N</td>`;

const css = `
*{box-sizing:border-box}
body{font:9.5pt/1.4 -apple-system,"Helvetica Neue",Arial,sans-serif;color:#17324B;margin:0}
h1{font-size:24pt;margin:0 0 4pt;letter-spacing:-.02em}
h2{font-size:15pt;margin:0 0 6pt;border-bottom:2px solid #087E8B;padding-bottom:3pt}
h3{font-size:11pt;margin:12pt 0 4pt}
p{margin:0 0 6pt}
.part{break-before:page}
.sub{color:#4A5D6E}
.small{font-size:8pt;color:#4A5D6E}
table{width:100%;border-collapse:collapse;margin:4pt 0 8pt}
th{background:#E2F3F3;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.03em}
th,td{border:1px solid #B9C7CC;padding:3pt 5pt;vertical-align:top}
thead{display:table-header-group}
tr{break-inside:avoid}
.sec td{background:#EDF2F2;font-weight:700}
.chk{white-space:nowrap;width:62pt}
.cmt{width:105pt}
.no{width:34pt;text-align:right}
.box{display:inline-block;width:8pt;height:8pt;border:1px solid #17324B;vertical-align:-1pt}
.ref{font:7.5pt/1.3 ui-monospace,Menlo,monospace;word-break:break-all}
.note{color:#4A5D6E;font-size:8pt;overflow-wrap:anywhere}
.tag{display:inline-block;border:1px solid #8A5A0A;color:#8A5A0A;border-radius:3pt;padding:0 3pt;font-size:7.5pt;margin-right:3pt}
.warn{background:#FBF0DA;border:1px solid #E8CF9C;padding:6pt 8pt;border-radius:4pt;margin:6pt 0}
ul{margin:2pt 0 6pt;padding-left:14pt} li{margin:1pt 0}
.sig td{height:30pt}
`;

export function reviewHtml(d: PdfInput): string {
  const guideCount = d.guide.stages.reduce((n, s) => n + s.items.length, 0);
  const engCount = d.english.reading.length + d.english.writing.length + d.english.instructions.length + d.english.vocabulary.length + d.english.conversation.length;
  const qTotal = d.packs.reduce((n, p) => n + p.questions.length, 0);

  const refRows = d.refs.map((r) => `<tr><td>${esc(r.label)}</td><td class="ref">${r.ref}</td></tr>`).join("");

  const statements = d.routes.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.text)}</td>${ok}<td class="cmt"></td></tr>`).join("");
  const extra = [
    ["Stop rules", "2025 test: up to 20 asked, 12 correct passes, stops at 12 correct or 9 incorrect. 2008 test: up to 10 asked, 6 correct passes, stops at 6 correct or 5 incorrect. 65/20 format: 20 designated questions, up to 10 asked, 6 to pass."],
    ["Who chooses the 65/20 format", "The learner chooses it. The app does not decide eligibility, age or years as a permanent resident."],
    ["Questions whose answers change (18)", "The app never supplies these answers. It shows an official lookup link, and the learner records the answer they confirmed, where it applies and the date they checked. Unconfirmed ones are practiced but left out of mock scoring."],
    ["Disclaimers shown in the app", "“OathSteps is a private study tool, not a government service and not legal advice.” “Not affiliated with USCIS.” “We never ask for your SSN, A-Number, ID or USCIS password.” “Official wording · machine-checked, not yet expert-reviewed.”"],
    ["Interview practice statements", "“Use your own true answers. We never suggest them.” “Use your own true information.” Readiness is shown as counts with denominators, never as a percentage or a prediction."],
  ].map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td>${ok}<td class="cmt"></td></tr>`).join("");

  const guide = d.guide.stages
    .map((s) => `<tr class="sec"><td colspan="6">${esc(s.title)}</td></tr>` + s.items.map((i) => `<tr><td>${esc(i.id)}</td><td>${esc(i.text)}</td><td>${esc(i.why)}</td><td class="note">${(i.links ?? []).map((k) => `${esc(d.guide.sources[k].label)}<br>${esc(d.guide.sources[k].url)}`).join("<br>")}</td>${ok}<td class="cmt"></td></tr>`).join(""))
    .join("");

  const row = (id: string, a: string, b: string) => `<tr><td>${esc(id)}</td><td>${esc(a)}</td><td>${esc(b)}</td>${ok}<td class="cmt"></td></tr>`;
  const eng = [
    ["Reading sentences", d.english.reading.map((x) => row(x.id, x.text, ""))],
    ["Writing sentences", d.english.writing.map((x) => row(x.id, x.text, ""))],
    ["Officer instructions", d.english.instructions.map((x) => row(x.id, x.text, x.meaning))],
    ["Vocabulary", d.english.vocabulary.map((x) => row(x.id, x.term, x.meaning))],
    ["Conversation prompts", d.english.conversation.map((x) => row(x.id, x.prompt, x.tip))],
  ]
    .map(([t, rows]) => `<tr class="sec"><td colspan="6">${esc(t as string)}</td></tr>${(rows as string[]).join("")}`)
    .join("");

  const bank = (p: PdfInput["packs"][number], n: number) => {
    let last = "";
    const rows = p.questions
      .map((q) => {
        const head = q.subsection !== last ? ((last = q.subsection), `<tr class="sec"><td colspan="6">${esc(q.section)} · ${esc(q.subsection)}</td></tr>`) : "";
        const flags = [q.special ? '<span class="tag">65/20</span>' : "", q.dynamic ? '<span class="tag">Answer varies</span>' : "", q.requiredCount > 1 ? `<span class="note">${q.requiredCount} needed</span>` : ""].join("");
        const answers = q.answers.map((a) => `<div>${esc(a.text)}${a.note ? ` <span class="note">[${esc(a.note)}]</span>` : ""}</div>`).join("");
        const lookup = q.dynamic ? `<div class="note">App shows lookup: ${esc(q.dynamic.lookupUrl)}</div>` : "";
        return `${head}<tr><td class="no">${q.number}</td><td>${esc(q.prompt)}</td><td>${answers}${lookup}</td><td>${flags}</td>${ok}<td class="cmt"></td></tr>`;
      })
      .join("");
    return `<section class="part"><h2>Part ${n}. ${esc(p.title)}</h2><p class="sub">Version ${esc(p.version)}. Official wording from USCIS. Please check each answer against the official PDF in content/sources/.</p>
<table><thead><tr><th class="no">No.</th><th>Official question</th><th>Accepted answers (official wording)</th><th>Flags</th><th class="chk">Matches PDF?</th><th class="cmt">Comment</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  };

  const signRows = d.refs.map((r) => `<tr class="sig"><td>${esc(r.label)}<div class="ref">${r.ref}</div></td><td class="chk">${box} Approve<br>${box} Changes needed</td><td class="cmt"></td></tr>`).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OathSteps content review packet</title><style>${css}</style></head><body>
<section>
<h1>OathSteps content review packet</h1>
<p class="sub">Prepared ${esc(d.date)} for an expert reviewer</p>
<div class="warn"><strong>Status of the content today:</strong> machine-checked only. A program verified counts, numbering and source-file hashes. No qualified person has reviewed the wording, the guide or the interview material. This packet asks for that review.</div>
<h3>What OathSteps is</h3>
<p>A free study tool that helps adults prepare for the U.S. naturalization civics test and interview: civics question practice, interview English practice, a step-by-step preparation guide and a manual journey tracker. It is not affiliated with USCIS, gives no legal advice, does not prepare or file forms and does not decide eligibility. Learners are told this on screen.</p>
<h3>What we are asking</h3>
<p>Please review the material below and tell us, for each scope, whether you approve it as written or what must change. You are not being asked to advise learners or to take on clients. Most of the effort is in Parts 1 to 3 (${guideCount + engCount} short items and a handful of statements you can read in one sitting). Part 4 describes how practice behaves. Parts 5 and 6 are the ${qTotal} official questions, copied word for word from two USCIS documents, for a spot check.</p>
<h3>What you are approving</h3>
<p>Each scope below is identified by a reference code (a SHA-256 fingerprint of the exact text). If the text changes later, your approval no longer applies to it and a new review is needed.</p>
<table><thead><tr><th>Scope</th><th>Content reference</th></tr></thead><tbody>${refRows}</tbody></table>
</section>
<section class="part"><h2>What to look for</h2>
<ul>
<li><strong>Questions:</strong> is each question and each accepted answer identical to the official USCIS document? Are the “answer varies” flags right? Especially check questions with several accepted answers and bracketed notes.</li>
<li><strong>Guide:</strong> is each step accurate, current and clear for an adult learner? Does any step sound like legal advice, promise an outcome, or tell someone what to answer? Are the linked sources the right official pages?</li>
<li><strong>Interview English:</strong> are the sentences, officer instructions, meanings and prompts appropriate and true to how interviews go? Does any prompt push a learner toward a particular answer about their own case?</li>
<li><strong>Statements the app makes</strong> (Part 1): are they correct and are the disclaimers enough?</li>
</ul>
<p class="small">How to return it: mark Y or N and add comments here or in the matching spreadsheets, then complete the sign-off on the last page. Your name stays out of the app. Only your credential and the date are shown, for example “Reviewed 2026-11-02 by Licensed attorney, State”.</p>
</section>

<section class="part"><h2>Part 1. Statements the app makes</h2>
<table><thead><tr><th style="width:120pt">Topic</th><th>What the app says or does</th><th class="chk">Correct?</th><th class="cmt">Comment</th></tr></thead><tbody>${statements}${extra}</tbody></table></section>

<section class="part"><h2>Part 2. Preparation guide (version ${esc(d.guide.version)}, ${guideCount} steps)</h2>
<p class="sub">Text written by OathSteps, not by USCIS. Each step links to official pages.</p>
<table><thead><tr><th style="width:48pt">ID</th><th style="width:105pt">Step</th><th style="width:36%">Why it matters (shown to learners)</th><th style="width:150pt">Official sources linked</th><th class="chk">Accurate and clear?</th><th class="cmt">Comment</th></tr></thead><tbody>${guide}</tbody></table></section>

<section class="part"><h2>Part 3. Interview English practice (version ${esc(d.english.version)}, ${engCount} items)</h2>
<p class="sub">Original practice material written by OathSteps. The reading and writing sentences use words from the USCIS vocabulary lists. They are not the sentences officers use.</p>
<table><thead><tr><th style="width:50pt">ID</th><th>Text</th><th>Meaning or tip shown to learners</th><th class="chk">Appropriate and accurate?</th><th class="cmt">Comment</th></tr></thead><tbody>${eng}</tbody></table></section>

<section class="part"><h2>Part 4. How practice and mock tests behave</h2>
<p>Please read this part as a plain description of the learner experience. The numbers come from the official rules in Part 1.</p>
<ul>
<li>Learners study with recall first: the question is shown, they answer aloud from memory, then reveal the official answer and mark how it went. Multiple choice and hints are labeled and never count as independent recall.</li>
<li>Mock tests follow the real stop rules. An “I’m not sure” answer counts as not correct in a mock.</li>
<li>The app shows counts such as “seen 20 of 128”, never a percentage, pass probability or promise.</li>
<li>The app never collects a Social Security number, A-Number, USCIS password, identity documents or N-400 answers.</li>
</ul></section>

${d.packs.map((p, i) => bank(p, 5 + i)).join("")}

<section class="part"><h2>Reviewer sign-off</h2>
<p>For each scope, mark Approve or Changes needed. If you approve, please complete the details below. Approval applies only to the content reference printed beside the scope.</p>
<table><thead><tr><th>Scope and content reference</th><th class="chk">Decision</th><th class="cmt">Conditions or notes</th></tr></thead><tbody>${signRows}</tbody></table>
<table class="sig"><tbody>
<tr class="sig"><td>Reviewer name</td><td></td><td>Date</td><td></td></tr>
<tr class="sig"><td>Credential (for example “Licensed attorney, New York” or “DOJ-accredited representative”)</td><td></td><td>Organization (optional)</td><td></td></tr>
<tr class="sig"><td>Signature</td><td></td><td>May we show your name in the app?</td><td>${box} Yes &nbsp;&nbsp;${box} No, credential only</td></tr>
</tbody></table>
</section>
</body></html>`;
}

export async function writeReviewPdf(d: PdfInput, path: string): Promise<boolean> {
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.warn(`PDF skipped: Chromium is not available (${(e as Error).message.split("\n")[0]}). Run: pnpm exec playwright install chromium`);
    return false;
  }
  try {
    const page = await browser.newPage();
    await page.setContent(reviewHtml(d), { waitUntil: "load" });
    await page.pdf({
      path,
      format: "Letter",
      landscape: true,
      printBackground: true,
      margin: { top: "0.6in", bottom: "0.7in", left: "0.6in", right: "0.6in" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: '<div style="font:8px Helvetica,Arial,sans-serif;width:100%;text-align:center;color:#4A5D6E">OathSteps content review packet · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
    return true;
  } finally {
    await browser.close();
  }
}
