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

## Next Steps
1. Align with Design team on ownership and sequencing (suggested order: RAL blueprint → Debug timeline → Performance dashboard).
2. Create Figma frames with asset specs; export to `public/visuals/tier-4/` once approved.
3. Update corresponding MDX modules to embed visuals and reference captions.
4. Track status in this doc; mark TODO item complete when assets ship and pages embed them.
