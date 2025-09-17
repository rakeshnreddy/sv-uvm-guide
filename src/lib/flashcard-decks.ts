import F1_Why_Verification from '../../content/flashcards/F1_Why_Verification.json';
import F2_Data_Types from '../../content/flashcards/F2_Data_Types.json';
import F3_Procedural_Constructs from '../../content/flashcards/F3_Procedural_Constructs.json';
import F4_RTL_and_Testbench_Constructs from '../../content/flashcards/F4_RTL_and_Testbench_Constructs.json';
import F2_HDL_Primer from '../../content/flashcards/F2_HDL_Primer.json';
import I_SV_1_OOP from '../../content/flashcards/I-SV-1_OOP.json';
import I_SV_2_Constrained_Randomization from '../../content/flashcards/I-SV-2_Constrained_Randomization.json';
import I_SV_3_Functional_Coverage from '../../content/flashcards/I-SV-3_Functional_Coverage.json';
import I_SV_4_Assertions_SVA from '../../content/flashcards/I-SV-4_Assertions_SVA.json';
import I_UVM_1_UVM_Intro from '../../content/flashcards/I-UVM-1_UVM_Intro.json';
import I_UVM_2_Building_TB from '../../content/flashcards/I-UVM-2_Building_TB.json';
import I_UVM_3_Sequences from '../../content/flashcards/I-UVM-3_Sequences.json';
import I_UVM_4_Factory_and_Overrides from '../../content/flashcards/I-UVM-4_Factory_and_Overrides.json';
import I_UVM_5_Phasing_and_Synchronization from '../../content/flashcards/I-UVM-5_Phasing_and_Synchronization.json';

export interface RawFlashcard {
  id: string;
  question: string;
  answer: string;
}

export const flashcardDecks: Record<string, RawFlashcard[]> = {
  F1_Why_Verification,
  F2_Data_Types,
  F3_Procedural_Constructs,
  F4_RTL_and_Testbench_Constructs,
  F2_HDL_Primer,
  'I-SV-1_OOP': I_SV_1_OOP,
  'I-SV-2_Constrained_Randomization': I_SV_2_Constrained_Randomization,
  'I-SV-3_Functional_Coverage': I_SV_3_Functional_Coverage,
  'I-SV-4_Assertions_SVA': I_SV_4_Assertions_SVA,
  'I-UVM-1_UVM_Intro': I_UVM_1_UVM_Intro,
  'I-UVM-2_Building_TB': I_UVM_2_Building_TB,
  'I-UVM-3_Sequences': I_UVM_3_Sequences,
  'I-UVM-4_Factory_and_Overrides': I_UVM_4_Factory_and_Overrides,
  'I-UVM-5_Phasing_and_Synchronization': I_UVM_5_Phasing_and_Synchronization,
};

export default flashcardDecks;
