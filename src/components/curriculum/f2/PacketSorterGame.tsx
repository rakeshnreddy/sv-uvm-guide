"use client";

import React from "react";

import ScenarioSorter from "@/components/visuals/ScenarioSorter";

/** Today's six container scenarios, now the "containers" deck of ScenarioSorter. */
export { PACKET_SORTER_CHALLENGES } from "@/lib/scenario-sorter-decks";

/**
 * F2B container drill. A thin wrapper: ScenarioSorter's "containers" deck keeps
 * this game's heading, scenarios, option feedback and packet-* test ids.
 *
 * Deliberate changes from the standalone game:
 * - each scenario lists its options in a mixed order: the game always put the
 *   best one first, so pressing the first button scored 6 of 6 (the scenarios,
 *   labels and feedback are unchanged);
 * and, shared with every deck:
 * - a PREDICT chip and hint sit above the options until the learner commits;
 * - after a pick, focus moves to the verdict sentence (one Tab reaches Next),
 *   and the learner's own pick is marked "• your pick" whatever its verdict;
 * - the reveal ends with a "Why not the others?" toggle that lists the options
 *   it has not explained, so every option does explain itself, as the summary
 *   and the F2B lesson promise (the game showed only the pick and the best);
 * - the results summary is no longer role="status": focus moves to the score,
 *   which is read on arrival;
 * - each summary row reads "You chose [X] · best is [Y]" with the options as
 *   chips, and the rule behind the better choice in its own paragraph, instead
 *   of "You chose X; best is Y. <feedback>".
 */
export const PacketSorterGame: React.FC = () => <ScenarioSorter deck="containers" testIdPrefix="packet" />;

export default PacketSorterGame;
