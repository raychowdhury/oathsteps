/**
 * Builds the static Privacy notice and Terms for GitHub Pages into ./site from the same components the app serves,
 * so the two can never drift. Operator details come from LEGAL_* in the environment (the Pages workflow sets them).
 * Run: pnpm legal:site
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactSection, LegalIntro, PrivacySections, TermsSections, type LegalHrefs } from "../src/components/LegalText";
import { legalInfo } from "../src/server/legal";

const legal = legalInfo(process.env);
const OUT = join(import.meta.dirname, "..", "site");
const hrefs: LegalHrefs = { privacy: "privacy.html", terms: "terms.html" };
const REPO = "https://github.com/raychowdhury/oathsteps";

const css = `
:root{--bg:#F7FAF9;--sf:#fff;--ink:#17324B;--mut:#4A5D6E;--line:#DFE7E7;--tls:#066B76;--amx:#FBF0DA;--fox:#E3F1E8}
@media (prefers-color-scheme:dark){:root{--bg:#0F1A22;--sf:#172530;--ink:#E6EEF2;--mut:#A9B8C3;--line:#2A3A46;--tls:#5CC8D3;--amx:#3A2D12;--fox:#15301F}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header,main,footer{max-width:44rem;margin:0 auto;padding:0 1rem}
header{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding-top:1rem;padding-bottom:1rem}
header strong{font-size:1.125rem}
nav{display:flex;gap:1rem}
a{color:var(--tls);text-underline-offset:2px}
main{display:flex;flex-direction:column;gap:1rem;padding-bottom:2rem}
h1,h2,p,ul{margin:0}
.o-h1{font-size:1.75rem;line-height:1.25;letter-spacing:-.02em}
.o-h2{font-size:1.125rem;line-height:1.5}
.o-meta{font-size:.8125rem;color:var(--mut)}
.o-strong{font-weight:600}
.o-stack-s{display:flex;flex-direction:column;gap:.5rem}
.o-card{background:var(--sf);border:1px solid var(--line);border-radius:16px;padding:1.25rem;display:flex;flex-direction:column;gap:.75rem}
.o-card-amber{background:var(--amx);border-color:transparent}
.o-card-ok{background:var(--fox);border-color:transparent}
ul.o-bullets{padding-left:1.25rem;display:flex;flex-direction:column;gap:.375rem}
footer{padding-bottom:2rem}
`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · OathSteps</title>
<meta name="description" content="${title} for OathSteps, a private study tool for the U.S. naturalization civics test and interview.">
<style>${css}</style>
</head>
<body>
<header><strong>OathSteps</strong><nav><a href="index.html">Home</a><a href="${hrefs.privacy}">Privacy notice</a><a href="${hrefs.terms}">Terms of use</a></nav></header>
<main>
${body}
</main>
<footer class="o-meta">OathSteps is a private study tool. It is not affiliated with USCIS and gives no legal advice. Source: <a href="${REPO}">${REPO.replace("https://", "")}</a></footer>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, ".nojekyll"), "");
writeFileSync(join(OUT, "privacy.html"), page("Privacy notice", renderToStaticMarkup(<><LegalIntro title="Privacy notice" legal={legal} /><PrivacySections legal={legal} /><ContactSection legal={legal} /></>)));
writeFileSync(join(OUT, "terms.html"), page("Terms of use", renderToStaticMarkup(<><LegalIntro title="Terms of use" legal={legal} /><TermsSections legal={legal} hrefs={hrefs} /><ContactSection legal={legal} /></>)));
writeFileSync(
  join(OUT, "index.html"),
  page(
    "Legal",
    `<h1 class="o-h1">OathSteps legal information</h1>
<p>OathSteps helps adults study for the U.S. naturalization civics test and interview. These pages say what the app stores and the terms for using it.</p>
<ul class="o-bullets"><li><a href="${hrefs.privacy}">Privacy notice</a></li><li><a href="${hrefs.terms}">Terms of use</a></li></ul>`,
  ),
);
console.log(`Legal site written to ${OUT}`);
