import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/Section";
import { InfoPage } from "@/components/templates/InfoPage";
import { Prose } from "@/components/ui/Prose";
import { siteLabel } from "@/lib/nav-labels";

import { HistoryLineage, HistoryTimeline } from "./HistoryTimeline";
import { HISTORY_SOURCES, KEYWORD_EDITIONS } from "./history-timeline";

/*
 * /history: a static page. It reads no session, database or learner data.
 * Every fact on it comes from history-timeline.ts, where each event cites the
 * sources listed in the References section below.
 */

export const metadata: Metadata = {
  title: siteLabel("/history"),
  description:
    "A sourced timeline of hardware verification languages and methodologies: Verilog (IEEE 1364), the Accellera SystemVerilog releases, IEEE 1800 from 2005 to 2023, e, and the path from VMM, AVM and OVM to UVM and IEEE 1800.2, with why each step happened.",
};

const linkClass =
  "rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function HistoryPage() {
  return (
    <InfoPage
      width="reading"
      prose={false}
      title="History of SystemVerilog and UVM"
      description="How a design language became a verification language, and how competing testbench libraries became one IEEE standard."
    >
      <Section id="history-short-version" title="The short version">
        <Prose>
          <ul>
            <li>
              <strong>Verilog</strong> became IEEE 1364 in 1995, so every tool implemented the same language.
            </li>
            <li>
              <strong>SystemVerilog</strong> started at Accellera in 2002 from donated technology: Superlog design and
              assertion subsets, and Synopsys&apos;s OpenVera testbench, assertions, C interface and coverage API.
            </li>
            <li>
              It became <strong>IEEE 1800-2005</strong>, an extension of IEEE 1364-2005, and in{" "}
              <strong>IEEE 1800-2009</strong> the two merged into one standard. The current edition is IEEE 1800-2023.
            </li>
            <li>
              Testbench methodologies (<strong>VMM</strong>, <strong>AVM</strong>, then <strong>OVM</strong>) gave
              teams a shared way to use the language. Accellera built <strong>UVM</strong> from OVM, with VMM concepts and code, in 2011.
            </li>
            <li>
              UVM became <strong>IEEE 1800.2-2017</strong>, revised as IEEE 1800.2-2020, and Accellera&apos;s open-source
              uvm-core library implements it.
            </li>
          </ul>
          <p>
            Each step solved a specific problem, and most of those problems still shape how you write a testbench today.
          </p>
        </Prose>
      </Section>

      <HistoryLineage />

      <HistoryTimeline />

      <Section id="history-keywords" title="What each edition added, in reserved words">
        <Prose>
          <p>
            IEEE 1800-2023 keeps a table of the reserved words each earlier edition introduced (§22.14), because{" "}
            <code>`begin_keywords</code> lets old code ask for an older edition&apos;s keyword set. Those tables are a
            compact record of what each step was for.
          </p>
        </Prose>

        <ul className="mt-4 space-y-3" aria-label="Reserved words by edition" data-testid="history-keywords">
          {KEYWORD_EDITIONS.map((edition) => (
            <li key={edition.edition} className="rounded-xl border border-border bg-card p-3 sm:p-4">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold text-foreground">{edition.edition}</span>
                <span className="text-xs text-muted-foreground">IEEE 1800-2023 {edition.table}</span>
              </p>
              <p className="mt-1 text-sm text-foreground">{edition.takeaway}</p>
              {edition.examples.length > 0 ? (
                <p className="mt-2 flex flex-wrap gap-1.5" aria-label={edition.complete ? "All added words" : "Some of the added words"}>
                  {edition.examples.map((word) => (
                    <code
                      key={word}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground [font-variant-ligatures:none]"
                    >
                      {word}
                    </code>
                  ))}
                  {edition.complete ? null : <span className="self-center text-xs text-muted-foreground">and more</span>}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="history-why-it-matters" title="Why this matters when you write a testbench">
        <Prose>
          <ul>
            <li>
              <strong>One language for design and verification.</strong> Classes, randomization, coverage and
              assertions sit in the same language as the RTL because they were donated into it, not bolted on beside it.
            </li>
            <li>
              <strong>Interoperability is the point of UVM.</strong> The IEEE 1800.2 introduction names the problem it
              solves: incompatible methodologies across teams limit productivity. That is why UVM components follow
              fixed conventions for phasing, configuration and transaction-level connections.
            </li>
            <li>
              <strong>Old names survive.</strong> UVM&apos;s TLM facilities are based on the OSCI SystemC TLM work, and its register
              layer started as VMM technology. When older code or papers mention OVM or VMM, they are describing
              UVM&apos;s ancestors.
            </li>
            <li>
              <strong>Cite the edition.</strong> This course cites IEEE 1800-2023 and IEEE 1800.2-2020. Tools and older
              material may follow an earlier edition, so when two sources disagree, check which one each follows.
            </li>
          </ul>
          <p>
            Ready to use all this? Start from the <Link href="/curriculum" className={linkClass}>curriculum</Link>.
          </p>
        </Prose>
      </Section>

      <Section id="history-references" title="References">
        <Prose>
          <p>
            Dates were checked against these sources. Where only a reprint of an announcement was available, the reprint
            is linked and named. The two IEEE standards are cited by clause from their own text.
          </p>
          <ol className="text-sm" data-testid="history-references">
            {HISTORY_SOURCES.map((source) => (
              <li key={source.id} id={`source-${source.id}`} className="scroll-mt-24 break-words">
                {source.url ? (
                  <a href={source.url} className={linkClass} rel="noopener noreferrer" target="_blank">
                    {source.label}
                  </a>
                ) : (
                  source.label
                )}
              </li>
            ))}
          </ol>
        </Prose>
      </Section>
    </InfoPage>
  );
}
