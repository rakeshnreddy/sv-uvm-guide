/**
 * Client-safe flashcard deck loading for the review page.
 *
 * Each canonical deck (no aliases: learner state is keyed by canonical deck
 * id, resolved on the server by getDeckCards in src/lib/flashcard-decks.ts)
 * has its own dynamic import, so the review page downloads only the decks in
 * its queue, one small chunk each. Lesson pages never use this module: the
 * lesson's server component passes its own deck's cards to FlashcardWidget.
 *
 * The map is explicit (one entry per canonical deck, with its file name; for
 * example 'A-UVM-5_Callbacks' lives in A-UVM-5_UVM_Callbacks.json), so the
 * bundler can see every chunk. tests/lib/flashcard-registry.test.ts checks
 * that its keys equal the registry's canonical deck ids and that every deck
 * loads the same cards as getDeckCards.
 */

/** A card as the widget and the review page show it. */
export interface FlashcardCard {
  /** Explicit and unique across decks (scripts/validate-flashcards.cjs); alias decks share ids. */
  id: string;
  front: string;
  back: string;
}

/** A deck under its canonical id. */
export interface DeckCards {
  deckId: string;
  cards: readonly FlashcardCard[];
}

/** A card as stored in content/flashcards/*.json: question/answer or front/back. */
export interface RawDeckCard {
  id?: string;
  question?: string;
  answer?: string;
  front?: string;
  back?: string;
}

/**
 * Turns a deck file's cards into {id, front, back}; a card without an id
 * (rejected by the validator) falls back to `${deckId}-${index}`. getDeckCards
 * in src/lib/flashcard-decks.ts applies the same mapping on the server.
 */
export function normalizeDeckCards(deckId: string, raw: readonly RawDeckCard[]): FlashcardCard[] {
  return raw.map((card, index) => ({
    id: typeof card.id === 'string' && card.id.length > 0 ? card.id : `${deckId}-${index}`,
    front: card.question ?? card.front ?? '',
    back: card.answer ?? card.back ?? '',
  }));
}

type DeckModule = { default: readonly RawDeckCard[] };

const DECK_LOADERS: Readonly<Record<string, () => Promise<DeckModule>>> = Object.freeze({
  'F1A_Cost_of_Bugs': () => import('../../content/flashcards/F1A_Cost_of_Bugs.json'),
  'F1B_Verification_Mindset': () => import('../../content/flashcards/F1B_Verification_Mindset.json'),
  'F1C_Why_SystemVerilog': () => import('../../content/flashcards/F1C_Why_SystemVerilog.json'),
  'F2_Data_Types': () => import('../../content/flashcards/F2_Data_Types.json'),
  'F2B_Dynamic_Structures': () => import('../../content/flashcards/F2B_Dynamic_Structures.json'),
  'F2E_First_Self_Checking_Testbench': () => import('../../content/flashcards/F2E_First_Self_Checking_Testbench.json'),
  'F2A_Structs_Unions_Enums': () => import('../../content/flashcards/F2A_Structs_Unions_Enums.json'),
  'F2A_Operators_and_Expressions': () => import('../../content/flashcards/F2A_Operators_and_Expressions.json'),
  'F3B_Scheduling_Regions': () => import('../../content/flashcards/F3B_Scheduling_Regions.json'),
  'F3C_Delta_Cycles': () => import('../../content/flashcards/F3C_Delta_Cycles.json'),
  'F2C_Procedural_Constructs': () => import('../../content/flashcards/F2C_Procedural_Constructs.json'),
  'F2D_IPC': () => import('../../content/flashcards/F2D_IPC.json'),
  'F2D_System_Tasks': () => import('../../content/flashcards/F2D_System_Tasks.json'),
  'F2D_Tasks_Functions': () => import('../../content/flashcards/F2D_Tasks_Functions.json'),
  'F3A_Simulation_Semantics': () => import('../../content/flashcards/F3A_Simulation_Semantics.json'),
  'F4A_Modules_and_Packages': () => import('../../content/flashcards/F4A_Modules_and_Packages.json'),
  'F4B_Interfaces_and_Modports': () => import('../../content/flashcards/F4B_Interfaces_and_Modports.json'),
  'I-UVM-4_Policy_Classes': () => import('../../content/flashcards/I-UVM-4_Policy_Classes.json'),
  'I-UVM-5_Container_Classes': () => import('../../content/flashcards/I-UVM-5_Container_Classes.json'),
  'I-UVM-6_UVM_Recording_Classes': () => import('../../content/flashcards/I-UVM-6_UVM_Recording_Classes.json'),
  'I-SV-5_Synchronization_and_IPC': () => import('../../content/flashcards/I-SV-5_Synchronization_and_IPC.json'),
  'B-APB-1_APB_Protocol_and_Verification': () => import('../../content/flashcards/B-APB-1_APB_Protocol_and_Verification.json'),
  'A-UVM-9_Reset_and_Error_Injection': () => import('../../content/flashcards/A-UVM-9_Reset_and_Error_Injection.json'),
  'E-DBG-1_Effective_Debug': () => import('../../content/flashcards/E-DBG-1_Effective_Debug.json'),
  'E-DBG-1_Hang_Lab': () => import('../../content/flashcards/E-DBG-1_Hang_Lab.json'),
  'E-SOC-1_PSS_Bridge': () => import('../../content/flashcards/E-SOC-1_PSS_Bridge.json'),
  'I-SV-8_Power_Intent_and_UPF': () => import('../../content/flashcards/I-SV-8_Power_Intent_and_UPF.json'),
  'I-UVM-1D_Reporting_and_Run_Control': () => import('../../content/flashcards/I-UVM-1D_Reporting_and_Run_Control.json'),
  'I-UVM-3C_First_Complete_Testbench': () => import('../../content/flashcards/I-UVM-3C_First_Complete_Testbench.json'),
  'I-SV-2A_Constrained_Randomization_Fundamentals': () => import('../../content/flashcards/I-SV-2A_Constrained_Randomization_Fundamentals.json'),
  'I-SV-2B_Advanced_Constrained_Randomization': () => import('../../content/flashcards/I-SV-2B_Advanced_Constrained_Randomization.json'),
  'I-SV-3A_Functional_Coverage_Fundamentals': () => import('../../content/flashcards/I-SV-3A_Functional_Coverage_Fundamentals.json'),
  'I-SV-3B_Advanced_Functional_Coverage': () => import('../../content/flashcards/I-SV-3B_Advanced_Functional_Coverage.json'),
  'I-SV-4A_Assertions_SVA_Fundamentals': () => import('../../content/flashcards/I-SV-4A_Assertions_SVA_Fundamentals.json'),
  'I-SV-4B_Advanced_SVA': () => import('../../content/flashcards/I-SV-4B_Advanced_SVA.json'),
  'I-SV-4C_Checkers_and_Bind': () => import('../../content/flashcards/I-SV-4C_Checkers_and_Bind.json'),
  'I-UVM-2A_Component_Roles': () => import('../../content/flashcards/I-UVM-2A_Component_Roles.json'),
  'I-UVM-2B_TLM_Connections': () => import('../../content/flashcards/I-UVM-2B_TLM_Connections.json'),
  'I-UVM-2C_Configuration_and_Resources': () => import('../../content/flashcards/I-UVM-2C_Configuration_and_Resources.json'),
  'I-UVM-3A_Fundamentals': () => import('../../content/flashcards/I-UVM-3A_Fundamentals.json'),
  'I-UVM-3B_Advanced_Sequencing': () => import('../../content/flashcards/I-UVM-3B_Advanced_Sequencing.json'),
  'I-SV-1_Constructors': () => import('../../content/flashcards/I-SV-1_Constructors.json'),
  'I-SV-1_Copying_and_Cloning': () => import('../../content/flashcards/I-SV-1_Copying_and_Cloning.json'),
  'I-SV-1_Polymorphism_Pitfalls': () => import('../../content/flashcards/I-SV-1_Polymorphism_Pitfalls.json'),
  'I-SV-1_Parameterized_Classes': () => import('../../content/flashcards/I-SV-1_Parameterized_Classes.json'),
  'I-SV-2B_Advanced_Constraints': () => import('../../content/flashcards/I-SV-2B_Advanced_Constraints.json'),
  'I-SV-2B_Controlling_Randomization': () => import('../../content/flashcards/I-SV-2B_Controlling_Randomization.json'),
  'I-SV-2B_Randomization_Methods': () => import('../../content/flashcards/I-SV-2B_Randomization_Methods.json'),
  'I-SV-2B_Solver_Debug': () => import('../../content/flashcards/I-SV-2B_Solver_Debug.json'),
  'I-SV-3B_Linking_Coverage': () => import('../../content/flashcards/I-SV-3B_Linking_Coverage.json'),
  'I-SV-3B_Coverage_APIs': () => import('../../content/flashcards/I-SV-3B_Coverage_APIs.json'),
  'I-SV-3B_Closure_Workflow': () => import('../../content/flashcards/I-SV-3B_Closure_Workflow.json'),
  'I-SV-4A_Immediate_vs_Concurrent': () => import('../../content/flashcards/I-SV-4A_Immediate_vs_Concurrent.json'),
  'I-SV-4B_Local_Variables': () => import('../../content/flashcards/I-SV-4B_Local_Variables.json'),
  'I-SV-4B_Multiclock_Assertions': () => import('../../content/flashcards/I-SV-4B_Multiclock_Assertions.json'),
  'I-UVM-3B_Sequencer_Driver_Handshake': () => import('../../content/flashcards/I-UVM-3B_Sequencer_Driver_Handshake.json'),
  'I-UVM-3B_Sequence_Arbitration': () => import('../../content/flashcards/I-UVM-3B_Sequence_Arbitration.json'),
  'I-UVM-3B_Sequence_Libraries': () => import('../../content/flashcards/I-UVM-3B_Sequence_Libraries.json'),
  'I-UVM-3B_Layered_Sequences': () => import('../../content/flashcards/I-UVM-3B_Layered_Sequences.json'),
  'I-UVM-3B_Virtual_Sequences': () => import('../../content/flashcards/I-UVM-3B_Virtual_Sequences.json'),
  'I-UVM-3B_Virtual_Sequencer': () => import('../../content/flashcards/I-UVM-3B_Virtual_Sequencer.json'),
  'I-UVM-3B_Interrupt_Handling': () => import('../../content/flashcards/I-UVM-3B_Interrupt_Handling.json'),
  'I-UVM-3B_Coordinated_Attack_Lab': () => import('../../content/flashcards/I-UVM-3B_Coordinated_Attack_Lab.json'),
  'I-SV-5_Events': () => import('../../content/flashcards/I-SV-5_Events.json'),
  'I-SV-5_Mailboxes': () => import('../../content/flashcards/I-SV-5_Mailboxes.json'),
  'I-SV-5_Semaphores': () => import('../../content/flashcards/I-SV-5_Semaphores.json'),
  'I-SV-9_Why_UVM': () => import('../../content/flashcards/I-SV-9_Why_UVM.json'),
  'I-SV-6_Compiler_Directives_and_Generates': () => import('../../content/flashcards/I-SV-6_Compiler_Directives_and_Generates.json'),
  'I-SV-7_DPI_and_Foreign_Language_Interfaces': () => import('../../content/flashcards/I-SV-7_DPI_and_Foreign_Language_Interfaces.json'),
  'F4C_Clocking_Blocks': () => import('../../content/flashcards/F4C_Clocking_Blocks.json'),
  'F2_HDL_Primer': () => import('../../content/flashcards/F2_HDL_Primer.json'),
  'I-SV-1_OOP': () => import('../../content/flashcards/I-SV-1_OOP.json'),
  'I-UVM-1_UVM_Intro': () => import('../../content/flashcards/I-UVM-1_UVM_Intro.json'),
  'I-UVM-4_Factory_and_Overrides': () => import('../../content/flashcards/I-UVM-4_Factory_and_Overrides.json'),
  'I-UVM-5_Phasing_and_Synchronization': () => import('../../content/flashcards/I-UVM-5_Phasing_and_Synchronization.json'),
  // T3 Advanced
  'A-UVM-1_Advanced_Sequencing': () => import('../../content/flashcards/A-UVM-1_Advanced_Sequencing.json'),
  'A-UVM-2_The_UVM_Factory': () => import('../../content/flashcards/A-UVM-2_The_UVM_Factory.json'),
  'A-UVM-3_Advanced_UVM_Techniques': () => import('../../content/flashcards/A-UVM-3_Advanced_UVM_Techniques.json'),
  'A-UVM-4A_RAL_Fundamentals': () => import('../../content/flashcards/A-UVM-4A_RAL_Fundamentals.json'),
  'A-UVM-4B_Advanced_RAL': () => import('../../content/flashcards/A-UVM-4B_Advanced_RAL.json'),
  'A-UVM-4B_Explicit_vs_Implicit': () => import('../../content/flashcards/A-UVM-4B_Explicit_vs_Implicit.json'),
  'A-UVM-4B_Frontdoor_vs_Backdoor': () => import('../../content/flashcards/A-UVM-4B_Frontdoor_vs_Backdoor.json'),
  'A-UVM-4B_Built_in_RAL_Sequences': () => import('../../content/flashcards/A-UVM-4B_Built_in_RAL_Sequences.json'),
  'A-UVM-5_Callbacks': () => import('../../content/flashcards/A-UVM-5_UVM_Callbacks.json'),
  'A-UVM-6_Scoreboards': () => import('../../content/flashcards/A-UVM-6_Scoreboards.json'),
  'A-UVM-7_VIP_Construction': () => import('../../content/flashcards/A-UVM-7_VIP_Construction.json'),
  'A-UVM-8_Multi_Agent_Topologies': () => import('../../content/flashcards/A-UVM-8_Multi_Agent_Topologies.json'),
  'B-AMBA-1_Protocol_Families_and_Tradeoffs': () => import('../../content/flashcards/B-AMBA-1_Protocol_Families_and_Tradeoffs.json'),
  'B-AMBA-2_Protocol_Intuition_and_Memory_Hooks': () => import('../../content/flashcards/B-AMBA-2_Protocol_Intuition_and_Memory_Hooks.json'),
  'B-AHB-1_AHB_Design_Timing_Mechanics': () => import('../../content/flashcards/B-AHB-1_AHB_Design_Timing_Mechanics.json'),
  'B-AHB-2_AHB_Pitfalls_and_Deadlocks': () => import('../../content/flashcards/B-AHB-2_AHB_Pitfalls_and_Deadlocks.json'),
  'B-AHB-3_AHB_Verification': () => import('../../content/flashcards/B-AHB-3_AHB_Verification.json'),
  'B-AXI-1_AXI_Channel_Architecture': () => import('../../content/flashcards/B-AXI-1_AXI_Channel_Architecture.json'),
  'B-AXI-2_AXI_Burst_Math': () => import('../../content/flashcards/B-AXI-2_AXI_Burst_Math.json'),
  'B-AXI-3_AXI_Ordering_and_IDs': () => import('../../content/flashcards/B-AXI-3_AXI_Ordering_and_IDs.json'),
  'B-AXI-4_AXI_Expert_Features_Cache_Atomics': () => import('../../content/flashcards/B-AXI-4_AXI_Expert_Features_Cache_Atomics.json'),
  'B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks': () => import('../../content/flashcards/B-AXI-5_AXI_Pitfalls_Interconnect_Deadlocks.json'),
  'B-AXI-6_AXI_Verification_Performance': () => import('../../content/flashcards/B-AXI-6_AXI_Verification_Performance.json'),
  'B-AMBA-F1_Bridges_and_System_Integration': () => import('../../content/flashcards/B-AMBA-F1_Bridges_and_System_Integration.json'),
  'B-AMBA-F2_Future_Protocols_ACE_CHI': () => import('../../content/flashcards/B-AMBA-F2_Future_Protocols_ACE_CHI.json'),
  'B-AMBA-F3_Interview_Debug_Clinic': () => import('../../content/flashcards/B-AMBA-F3_Interview_Debug_Clinic.json'),
  // T4 Expert
  'E-CUST-1_Methodology_Customization': () => import('../../content/flashcards/E-CUST-1_Methodology_Customization.json'),
  'E-DBG-1_Advanced_Debug': () => import('../../content/flashcards/E-DBG-1_Advanced_Debug.json'),
  'E-INT-1_UVM_Formal': () => import('../../content/flashcards/E-INT-1_UVM_Formal.json'),
  'E-PERF-1_UVM_Performance': () => import('../../content/flashcards/E-PERF-1_UVM_Performance.json'),
  'E-SOC-1_SoC_Verification': () => import('../../content/flashcards/E-SOC-1_SoC_Verification.json'),
  'E-PWR-1_Power_Aware_Verification': () => import('../../content/flashcards/E-PWR-1_Power_Aware_Verification.json'),
  'E-PSS-1_PSS': () => import('../../content/flashcards/E-PSS-1_PSS.json'),
  'E-PYUVM-1_Python_Verification': () => import('../../content/flashcards/E-PYUVM-1_Python_Verification.json'),
  'E-AI-1_AI_Driven_Verification': () => import('../../content/flashcards/E-AI-1_AI_Driven_Verification.json'),
  'E-RISCV-1_RISC_V_Verification': () => import('../../content/flashcards/E-RISCV-1_RISC_V_Verification.json'),
  'E-UVM-ML-1_Multi_Language': () => import('../../content/flashcards/E-UVM-ML-1_Multi_Language.json'),
  'E-EMU-1_Emulation': () => import('../../content/flashcards/E-EMU-1_Emulation.json'),
});

/** Every canonical deck id this module can load, in registry order. */
export function listLoadableDeckIds(): string[] {
  return Object.keys(DECK_LOADERS);
}

/** True when `deckId` is a canonical deck this module can load. */
export function hasDeckLoader(deckId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DECK_LOADERS, deckId);
}

/**
 * Loads one canonical deck. Resolves to null for an id that is not a canonical
 * deck (a deck since removed from the content); rejects when the chunk cannot
 * be downloaded, so callers can offer a retry.
 */
export async function loadDeck(deckId: string): Promise<DeckCards | null> {
  if (!hasDeckLoader(deckId)) return null;
  const deckModule = await DECK_LOADERS[deckId]();
  const raw = Array.isArray(deckModule.default) ? deckModule.default : [];
  return { deckId, cards: normalizeDeckCards(deckId, raw) };
}
