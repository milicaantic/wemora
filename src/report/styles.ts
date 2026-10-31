// Inline CSS for report.html. The page has no external files, so it also works opened straight from disk.
export const STYLES = `
:root {
  --bg: #f6f7f9; --panel: #ffffff; --text: #1d2433; --muted: #5b6577; --line: #e2e6ec;
  --proven: #1f8a4c; --proven-bg: #e3f4ea;
  --partial: #9a6a00; --partial-bg: #fdf3d6;
  --unproven: #5b6577; --unproven-bg: #eceff3;
  --failed: #c0362c; --failed-bg: #fbe5e3;
  --none: #7a8496; --none-bg: #ffffff;
  --code-bg: #f0f2f5;
  --k-analyzer: #3a6ea5; --k-architect: #7b4fb0; --k-tester: #1f8a7a; --k-builder: #c4661f; --k-other: #7a8496;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #12151b; --panel: #1b2029; --text: #e6e9ef; --muted: #9aa3b2; --line: #2c3340;
    --proven: #4cc27e; --proven-bg: #173323;
    --partial: #e3b341; --partial-bg: #3a3016;
    --unproven: #a3acba; --unproven-bg: #262c36;
    --failed: #f0756b; --failed-bg: #3d1f1d;
    --none: #8d96a6; --none-bg: #1b2029;
    --code-bg: #232935;
    --k-analyzer: #6b9fd6; --k-architect: #a985d6; --k-tester: #4cc2b0; --k-builder: #e8935a; --k-other: #8d96a6;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, "Segoe UI", Arial, sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 36px 0 12px; }
h3 { font-size: 16px; margin: 0; }
p { margin: 6px 0; }
.muted { color: var(--muted); }
code { background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 20px; }
.tile { background: var(--panel); border: 1px solid var(--line); border-left: 6px solid var(--c); border-radius: 8px; padding: 12px 16px; }
.tile .n { font-size: 28px; font-weight: 700; color: var(--c); }
.status-proven { --c: var(--proven); --cb: var(--proven-bg); }
.status-partial { --c: var(--partial); --cb: var(--partial-bg); }
.status-unproven { --c: var(--unproven); --cb: var(--unproven-bg); }
.status-failed { --c: var(--failed); --cb: var(--failed-bg); }
.status-no-result { --c: var(--none); --cb: var(--none-bg); }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--c); background: var(--cb); border: 1px solid var(--c); white-space: nowrap; }
.screen { background: var(--panel); border: 1px solid var(--line); border-top: 4px solid var(--c); border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; }
.screen-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.reason { margin-top: 8px; }
ul.plain { margin: 6px 0 0; padding-left: 20px; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
td.outcome { width: 44px; font-weight: 700; text-align: center; }
.pass { color: var(--proven); } .fail { color: var(--failed); } .not-run { color: var(--muted); }
.error { color: var(--failed); overflow-wrap: anywhere; }
.shared td:first-child { width: 30%; }
.warnings { background: var(--partial-bg); border: 1px solid var(--partial); border-radius: 8px; padding: 12px 18px; }
.run-stop { margin: 16px 0; }
.run-stop ol { margin: 8px 0 0; padding-left: 22px; }
.timeline-box { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; overflow-x: auto; }
svg.timeline { display: block; width: 100%; min-width: 720px; height: auto; }
.table-scroll { overflow-x: auto; }
.table-scroll table { min-width: 560px; }
.table-scroll td code { white-space: nowrap; }
svg.timeline text { fill: var(--text); font: 12px system-ui, "Segoe UI", Arial, sans-serif; }
svg.timeline .tick { fill: var(--muted); font-size: 11px; }
svg.timeline .grid { stroke: var(--line); stroke-dasharray: 2 3; }
svg.timeline .lane { stroke: var(--line); }
svg.timeline .bar-text { fill: #ffffff; font-size: 11px; pointer-events: none; }
.bar.open { opacity: 0.55; }
.kind-analyzer { fill: var(--k-analyzer); background: var(--k-analyzer); }
.kind-architect { fill: var(--k-architect); background: var(--k-architect); }
.kind-tester { fill: var(--k-tester); background: var(--k-tester); }
.kind-builder { fill: var(--k-builder); background: var(--k-builder); }
.kind-other { fill: var(--k-other); background: var(--k-other); }
circle.joined, i.dot.joined { fill: var(--text); background: var(--text); }
circle.left, i.dot.left { fill: var(--panel); stroke: var(--text); stroke-width: 1.5; background: var(--panel); border: 1.5px solid var(--text); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { display: inline-block; }
.swatch { width: 14px; height: 10px; border-radius: 2px; }
i.dot { width: 8px; height: 8px; border-radius: 50%; box-sizing: border-box; }
td.num, th.num { text-align: right; white-space: nowrap; }
tfoot td { font-weight: 600; border-bottom: none; }
@media (max-width: 640px) { main { padding: 20px 16px 48px; } td, th { padding: 6px; } }
`
