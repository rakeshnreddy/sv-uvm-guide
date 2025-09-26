# Advanced Visual Asset Gap Analysis

Document owner: Content/VX shared backlog (updated 2025-09-18)

We have migrated Tier-3/4 curriculum content, but several advanced modules still rely on shared visuals. This analysis identifies the unique visual artefacts required to meet the Digital Blueprint Definition of Done (Quick Take visual + section-level illustration).

## A-UVM-4 · UVM Register Abstraction Layer (RAL)
- **Current coverage:** Shared `UvmTestbenchVisualizer` diagram, interactive code walkthroughs.
- **Pain point:** Learners lack a dedicated visual showing how logical register maps bind to bus adapters and scoreboards; hybrid frontdoor/backdoor flows are still described only in text.

| Asset | Format | Intent | Capture Notes |
| --- | --- | --- | --- |
| RAL Mapping Blueprint | SVG + subtle animation | Show `uvm_reg_block` → `uvm_reg_map` routing into bus agents and predictors. | Layered glass panels with callouts for register generation, adapter, predictor. Animated arrows alternating frontdoor/backdoor paths. |
| Frontdoor vs Backdoor Timeline | Lottie/JSON animation (After Effects export) | Compare latency + visibility of frontdoor (`axi_seq_item`) vs backdoor (`uvm_reg::poke`) operations. | 3 step timeline: sequence, adapter, DUT/register file. Highlight scoreboard observation points. |
| Mirror Health Heatmap | Static SVG | Visualize `uvm_reg::mirror` drift (expected vs actual snapshot). | 4x4 heatmap grid with color scale and legend, include “mirror policy” callouts. |

## E-PERF-1 · UVM Performance
- **Current coverage:** Profiling text snippet, narrative bullet points.
- **Pain point:** No visual cues for performance pipeline or regression tuning levers; difficult to convey process without diagrams.

| Asset | Format | Intent | Capture Notes |
| --- | --- | --- | --- |
| Regression Throughput Dashboard | Responsive SVG or D3 embed | Display CPU hours, queue depth, license utilization in one snapshot. | Mimic glass dashboard style; include sparkline for runtime trend, donut for license pool usage, headline KPI cards. |
| Hotspot Anatomy Diagram | SVG | Break down a "slow scoreboard" example showing log volume, analysis FIFOs, compare loops. | Annotate with percentages from profiler output; use glow nodes for hotspots. |
| Performance Mode Switcher | Micro-interaction (Lottie) | Illustrate toggling between `perf_profile = smoke/full`. | Two state toggle with tooltips for disabled coverage/logging; include config DB callouts. |

## E-DBG-1 · Advanced Debug
- **Current coverage:** Shared `UvmTestbenchVisualizer`, interactive code, text description of workflows.
- **Pain point:** Debug workflow lacks visuals for objection tracing, transaction timelines, and instrumentation stack; need animated overview.

| Asset | Format | Intent | Capture Notes |
| --- | --- | --- | --- |
| Objection Cascade Timeline | Animated SVG (GSAP-friendly) | Show objections raising/dropping across components to locate hangs. | Horizontal swimlane timeline with icons for `raise/drop`; highlight stuck component in red. |
| Instrumentation Stack Blueprint | Static SVG | Layer logs, transaction DB, waveform clips, analytics dashboard. | Stack of translucent cards; annotate where knobs (`+UVM_OBJECTION_TRACE`, `UVM_RECORD`) plug in. |
| Debug Control Room Mock | 3-panel illustration | Convey the “air-traffic control” metaphor (logs, transactions, waveforms). | Use blueprint palette, include mini-monitor screens displaying sample data; tie to Quick Take analogy. |

## Delivery Tracker

| Asset | Owner | Status | Target Sprint | Notes |
| --- | --- | --- | --- | --- |
| RAL Mapping Blueprint | VX – Harper | ✅ Complete | Oct Sprint A | Exported `public/visuals/tier-4/ral-mapping-blueprint.svg`; ready for MDX embed. |
| Frontdoor vs Backdoor Timeline | VX – Harper | ✅ Complete | Oct Sprint A | Timeline visualization shipped (`frontdoor-backdoor-timeline.svg`) with contrast-checked palette. |
| Mirror Health Heatmap | Data Viz – Chen | ✅ Complete | Oct Sprint A | Heatmap asset generated (`mirror-health-heatmap.svg`) with legend offsets baked in. |
| Regression Throughput Dashboard | Data Viz – Chen | ✅ Complete | Oct Sprint A | Dashboard mock exported (`regression-throughput-dashboard.svg`) reflecting current KPI set. |
| Hotspot Anatomy Diagram | Content – Priya | ✅ Complete | Oct Sprint A | Scoreboard hotspot diagram (`hotspot-anatomy-diagram.svg`) annotated per profiling log. |
| Performance Mode Switcher | VX – Elena | ✅ Complete | Oct Sprint A | Toggle asset delivered (`performance-mode-switcher.svg`) with accessible labels baked in. |
| Objection Cascade Timeline | VX – Elena | ✅ Complete | Oct Sprint A | Timeline asset (`objection-cascade-timeline.svg`) highlights stalled drop scenario. |
| Instrumentation Stack Blueprint | VX – Elena | ✅ Complete | Oct Sprint A | Layered stack blueprint (`instrumentation-stack-blueprint.svg`) exported to tier-4 library. |
| Debug Control Room Mock | VX – Elena | ✅ Complete | Oct Sprint A | Air-traffic inspired mock (`debug-control-room-mock.svg`) available for hero embeds. |

## Rolling Actions
1. Confirm ownership assignments above with Design/VX leads in 2025-10-03 stand-up (Harper to post summary in `#visual-assets`).
2. Create Figma frames and export SVG/Lottie assets to `public/visuals/tier-4/` once each item reaches ✅.
3. Update embedded visuals within the relevant MDX modules, documenting captions and accessibility notes.
4. Maintain this tracker; mark status ✅ when assets ship and modules reference the new visuals.
