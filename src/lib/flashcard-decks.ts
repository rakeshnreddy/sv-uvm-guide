import F1_Why_Verification from '../../content/flashcards/F1_Why_Verification.json';
import F2_Data_Types from '../../content/flashcards/F2_Data_Types.json';
import F3_Procedural_Constructs from '../../content/flashcards/F3_Procedural_Constructs.json';
import F4_RTL_and_Testbench_Constructs from '../../content/flashcards/F4_RTL_and_Testbench_Constructs.json';
import F2_HDL_Primer from '../../content/flashcards/F2_HDL_Primer.json';
import I_SV_1_OOP from '../../content/flashcards/I-SV-1_OOP.json';
import I_SV_2_Constrained_Randomization from '../../content/flashcards/I-SV-2_Constrained_Randomization.json';
import I_SV_3_Functional_Coverage from '../../content/flashcards/I-SV-3_Functional_Coverage.json';

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
};

export default flashcardDecks;
