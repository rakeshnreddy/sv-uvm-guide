"use client";

import React, { useCallback, useMemo, useState } from "react";

import { CodeTrace } from "@/components/visual-system/CodeTrace";
import { PredictionPrompt } from "@/components/visual-system/PredictionPrompt";
import { SegmentedControl } from "@/components/visual-system/SegmentedControl";
import { VisualFrame } from "@/components/visual-system/VisualFrame";
import {
  FACTORY_MODEL_ASSUMPTIONS,
  FactoryMessages,
  FactoryTree,
  LookupLog,
  RevealSignal,
  factoryOptions,
  toCodeLines,
} from "@/components/visualizers/FactoryOverrideExplorerVisualizer";
import {
  FACTORY_CLASSES,
  OUTCOME_FATAL,
  builderSource,
  classDeclarations,
  explainNode,
  nodeResult,
  objectCreatorSource,
  outcomeOf,
  runFactoryProgram,
  standardTree,
  testSource,
  type BuildNode,
  type ClassTable,
  type FactoryProgram,
  type PlacedOverride,
} from "@/lib/uvm-factory-model";

const ROOT = "uvm_test_top";
const DRV0 = "uvm_test_top.env.agt0.drv";
const DRV1 = "uvm_test_top.env.agt1.drv";
const TR0 = "uvm_test_top.env.agt0.mon.tr";

type Variant = { overrides: PlacedOverride[]; target: string; classes?: ClassTable; txnContext?: "parent" | "none" };

interface Scenario {
  id: string;
  label: string;
  story: string;
  base: Variant;
  flip: { label: string; variant: Variant };
  /** Which builder code to show. */
  show: "agent" | "monitor";
}

const type = (id: string, original: string, override: string, replace = true): PlacedOverride => ({ id, kind: "type", original, override, replace, placement: "test-build-before" });
const inst = (id: string, original: string, override: string, pathArg: string, withThis = true): PlacedOverride => ({
  id,
  kind: "inst",
  original,
  override,
  pathArg,
  parentPath: withThis ? ROOT : null,
  placement: "test-build-before",
});

const registeredQuiet: ClassTable = FACTORY_CLASSES.map((c) => (c.name === "quiet_driver" ? { ...c, registered: true } : c));

const SCENARIOS: Scenario[] = [
  {
    id: "order",
    label: "General vs specific",
    story: "The test registers a broad instance override for every driver under env, then a specific one for agt0's driver.",
    base: { overrides: [inst("a", "base_driver", "mock_driver", "uvm_test_top.env.*", false), inst("b", "base_driver", "err_driver", "env.agt0.drv")], target: DRV0 },
    flip: {
      label: "Register the specific override first",
      variant: { overrides: [inst("b", "base_driver", "err_driver", "env.agt0.drv"), inst("a", "base_driver", "mock_driver", "uvm_test_top.env.*", false)], target: DRV0 },
    },
    show: "agent",
  },
  {
    id: "inst-type",
    label: "Instance vs type",
    story: "A type override was registered first; an instance override for agt1's driver comes second.",
    base: { overrides: [type("t", "base_driver", "err_driver"), inst("i", "base_driver", "mock_driver", "env.agt1.drv")], target: DRV1 },
    flip: { label: "Ask about agt0's driver instead", variant: { overrides: [type("t", "base_driver", "err_driver"), inst("i", "base_driver", "mock_driver", "env.agt1.drv")], target: DRV0 } },
    show: "agent",
  },
  {
    id: "chain",
    label: "Chained overrides",
    story: "One override maps base_driver to mock_driver; another maps mock_driver to err_driver.",
    base: { overrides: [type("1", "base_driver", "mock_driver"), type("2", "mock_driver", "err_driver")], target: DRV0 },
    flip: { label: "Swap the order of the two calls", variant: { overrides: [type("2", "mock_driver", "err_driver"), type("1", "base_driver", "mock_driver")], target: DRV0 } },
    show: "agent",
  },
  {
    id: "replace",
    label: "replace = 0",
    story: "Two type overrides for base_driver. The second passes replace = 0.",
    base: { overrides: [type("1", "base_driver", "mock_driver"), type("2", "base_driver", "err_driver", false)], target: DRV0 },
    flip: { label: "Use the default replace = 1", variant: { overrides: [type("1", "base_driver", "mock_driver"), type("2", "base_driver", "err_driver")], target: DRV0 } },
    show: "agent",
  },
  {
    id: "macro",
    label: "Missing macro",
    story: "quiet_driver extends base_driver but its author forgot `uvm_component_utils. The test overrides base_driver with it.",
    base: { overrides: [type("1", "base_driver", "quiet_driver")], target: DRV0 },
    flip: { label: "Add `uvm_component_utils(quiet_driver)", variant: { overrides: [type("1", "base_driver", "quiet_driver")], target: DRV0, classes: registeredQuiet } },
    show: "agent",
  },
  {
    id: "object",
    label: "Object without context",
    story: "agt0's monitor creates a transaction in run_phase. The test targets it with an instance override under agt0.mon.",
    base: { overrides: [inst("1", "my_txn", "err_txn", "env.agt0.mon.*")], target: TR0, txnContext: "none" },
    flip: { label: 'Pass this: create("tr", this)', variant: { overrides: [inst("1", "my_txn", "err_txn", "env.agt0.mon.*")], target: TR0, txnContext: "parent" } },
    show: "monitor",
  },
];

function treeFor(variant: Variant): BuildNode {
  const tree = standardTree();
  if (!variant.txnContext) return tree;
  const addTxn = (n: BuildNode): BuildNode => ({
    ...n,
    children: (n.children ?? []).map((c) =>
      c.name === "mon" ? { ...c, children: [{ name: "tr", requested: "my_txn", context: variant.txnContext, createdIn: "run" as const }] } : addTxn(c),
    ),
  });
  return addTxn(tree);
}

/** Prediction-first factory puzzles. Each runs the same engine as the explorer. */
export default function FactoryOverrideVisualizer() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [flipped, setFlipped] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const onReveal = useCallback((k: string) => setRevealedKey(k), []);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const variant = flipped ? scenario.flip.variant : scenario.base;

  const program: FactoryProgram = useMemo(
    () => ({ classes: variant.classes ?? FACTORY_CLASSES, root: treeFor(variant), overrides: variant.overrides }),
    [variant],
  );
  const run = useMemo(() => runFactoryProgram(program), [program]);
  const key = `${scenario.id}:${flipped ? "flip" : "base"}`;
  const revealed = revealedKey === key;
  const node = nodeResult(run, variant.target);
  const options = useMemo(() => factoryOptions(program, run, variant.target), [program, run, variant.target]);
  const decidingCall = revealed ? node?.lookup?.hops.find((h) => h.chosen)?.chosen?.callId : undefined;

  const env = program.root.children?.[0];
  const agentChildren = env?.children?.[0]?.children ?? [];
  const monitorObjects = agentChildren.find((c) => c.name === "mon")?.children ?? [];
  const involved = Array.from(new Set(program.overrides.flatMap((o) => [o.original, o.override])));

  return (
    <VisualFrame
      label="Predict the UVM factory"
      eyebrow="Predict, then check"
      title="Which class does create() build?"
      summary="Six short puzzles on one factory model. Commit to an answer, read the factory's lookup, then change one thing and predict again."
      fidelity="model"
      assumptions={FACTORY_MODEL_ASSUMPTIONS}
    >
      <SegmentedControl
        label="Factory puzzle"
        options={SCENARIOS.map((s) => ({ value: s.id, label: s.label }))}
        value={scenarioId}
        onChange={(id) => {
          setScenarioId(id);
          setFlipped(false);
        }}
      />
      <p className="text-sm text-foreground">
        {scenario.story}
        {flipped ? <strong className="ml-1 text-amber-800 dark:text-amber-200">Changed: {scenario.flip.label}.</strong> : null}
      </p>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        <CodeTrace label="my_test" lines={toCodeLines(testSource(program))} activeKey={decidingCall} className="min-w-0" />
        <div className="min-w-0 space-y-3">
          {scenario.show === "agent" ? (
            <CodeTrace label="my_agent (agt0 and agt1)" lines={toCodeLines(builderSource("my_agent", agentChildren))} activeKey={revealed ? "create-drv" : undefined} />
          ) : (
            <CodeTrace label="my_monitor" lines={toCodeLines(objectCreatorSource("my_monitor", "uvm_monitor", monitorObjects))} activeKey={revealed ? "create-tr" : undefined} />
          )}
          <CodeTrace label="Classes involved" lines={toCodeLines(classDeclarations(program.classes, involved))} />
        </div>
      </div>

      <PredictionPrompt
        question={
          <>
            What does create() build for <code className="font-mono text-[13px] [font-variant-ligatures:none]">{variant.target}</code>?
          </>
        }
        options={options}
        resetKey={key}
      >
        {node ? (
          <div className="space-y-3">
            <RevealSignal id={key} onReveal={onReveal} />
            <p aria-live="polite" className="text-sm text-foreground">
              <strong>
                Builds {outcomeOf(node) === OUTCOME_FATAL ? "nothing: UVM_FATAL [FCTTYP]" : outcomeOf(node)}.
              </strong>{" "}
              {explainNode(program, run, variant.target)}
            </p>
            <LookupLog program={program} node={node} />
            <FactoryMessages messages={run.messages.filter((m) => m.severity !== "INFO" || m.id === "TPREGD" || m.id === "TPREGR")} />
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="inline-flex min-h-10 items-center rounded-lg border border-amber-500/70 bg-amber-500/10 px-3 text-sm font-semibold text-foreground hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {flipped ? "Undo the change" : `Change one thing: ${scenario.flip.label}`} → predict again
            </button>
          </div>
        ) : null}
      </PredictionPrompt>

      <FactoryTree program={program} run={run} revealed={revealed} target={variant.target} />
    </VisualFrame>
  );
}
