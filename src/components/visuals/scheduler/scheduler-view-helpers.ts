import { scenarioToSource, type ExplorationResult, type SvScenario } from "@/lib/sv-scheduler-model";
import type { CodeTraceLine } from "@/components/visual-system/CodeTrace";

export interface OrderingOption {
  key: string;
  label: string;
  choices: number[];
}

/** Lists every legal ordering of a scenario as selectable options. */
export function orderingOptions(scenario: SvScenario, exploration: ExplorationResult): OrderingOption[] {
  const labelOf = (id: string) => scenario.processes.find((p) => p.id === id)?.label ?? id;
  return exploration.outcomes
    .flatMap((o) => o.runs)
    .map((run) => ({
      key: run.choices.join(".") || "only",
      label: run.executionOrder.map(labelOf).join(" → "),
      choices: run.choices,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function codeLinesFor(scenario: SvScenario): CodeTraceLine[] {
  const owners = new Map(scenario.processes.map((p) => [p.id, p.owner]));
  return scenarioToSource(scenario).map((line) => ({
    text: line.text,
    key: line.stmtId ?? (line.processId ? `${line.processId}:${line.text}` : undefined),
    owner: line.processId ? owners.get(line.processId) : undefined,
  }));
}
