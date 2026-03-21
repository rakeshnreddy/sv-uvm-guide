import F1A_Cost_of_Bugs from '../../content/flashcards/F1A_Cost_of_Bugs.json';
import F1B_Verification_Mindset from '../../content/flashcards/F1B_Verification_Mindset.json';
import F1C_Why_SystemVerilog from '../../content/flashcards/F1C_Why_SystemVerilog.json';
import F2_Data_Types from '../../content/flashcards/F2_Data_Types.json';
import F2C_Operators from '../../content/flashcards/F2C_Operators.json';
import F3A_Procedural_Blocks_and_Flow_Control from '../../content/flashcards/F3A_Procedural_Blocks_and_Flow_Control.json';
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
// T3 Advanced flashcard decks
import A_UVM_1_Advanced_Sequencing from '../../content/flashcards/A-UVM-1_Advanced_Sequencing.json';
import A_UVM_2_The_UVM_Factory from '../../content/flashcards/A-UVM-2_The_UVM_Factory.json';
import A_UVM_3_Advanced_UVM_Techniques from '../../content/flashcards/A-UVM-3_Advanced_UVM_Techniques.json';
import A_UVM_4_RAL from '../../content/flashcards/A-UVM-4_RAL.json';
import A_UVM_5_Callbacks from '../../content/flashcards/A-UVM-5_UVM_Callbacks.json';
import A_UVM_6_Scoreboards from '../../content/flashcards/A-UVM-6_Scoreboards.json';
import A_UVM_7_VIP_Construction from '../../content/flashcards/A-UVM-7_VIP_Construction.json';
import A_UVM_8_Multi_Agent_Topologies from '../../content/flashcards/A-UVM-8_Multi_Agent_Topologies.json';
// T4 Expert flashcard decks
import E_CUST_1_Methodology_Customization from '../../content/flashcards/E-CUST-1_Methodology_Customization.json';
import E_DBG_1_Advanced_Debug from '../../content/flashcards/E-DBG-1_Advanced_Debug.json';
import E_INT_1_UVM_Formal from '../../content/flashcards/E-INT-1_UVM_Formal.json';
import E_PERF_1_UVM_Performance from '../../content/flashcards/E-PERF-1_UVM_Performance.json';
import E_SOC_1_SoC_Verification from '../../content/flashcards/E-SOC-1_SoC_Verification.json';
import E_PSS_1_PSS from '../../content/flashcards/E-PSS-1_PSS.json';
import E_PYUVM_1_Python_Verification from '../../content/flashcards/E-PYUVM-1_Python_Verification.json';
import E_AI_1_AI_Driven_Verification from '../../content/flashcards/E-AI-1_AI_Driven_Verification.json';
import E_RISCV_1_RISC_V_Verification from '../../content/flashcards/E-RISCV-1_RISC_V_Verification.json';
import E_UVM_ML_1_Multi_Language from '../../content/flashcards/E-UVM-ML-1_Multi_Language.json';
import E_EMU_1_Emulation from '../../content/flashcards/E-EMU-1_Emulation.json';

export interface RawFlashcard {
  id: string;
  question: string;
  answer: string;
}

export const flashcardDecks: Record<string, RawFlashcard[]> = {
  F1A_Cost_of_Bugs,
  F1B_Verification_Mindset,
  F1C_Why_SystemVerilog,
  F2_Data_Types,
  F2C_Operators,
  F3A_Procedural_Blocks_and_Flow_Control,
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
  // T3 Advanced
  'A-UVM-1_Advanced_Sequencing': A_UVM_1_Advanced_Sequencing,
  'A-UVM-2_The_UVM_Factory': A_UVM_2_The_UVM_Factory,
  'A-UVM-3_Advanced_UVM_Techniques': A_UVM_3_Advanced_UVM_Techniques,
  'A-UVM-4_RAL': A_UVM_4_RAL,
  'A-UVM-5_Callbacks': A_UVM_5_Callbacks,
  'A-UVM-6_Scoreboards': A_UVM_6_Scoreboards,
  'A-UVM-7_VIP_Construction': A_UVM_7_VIP_Construction,
  'A-UVM-8_Multi_Agent_Topologies': A_UVM_8_Multi_Agent_Topologies,
  // T4 Expert
  'E-CUST-1_Methodology_Customization': E_CUST_1_Methodology_Customization,
  'E-DBG-1_Advanced_Debug': E_DBG_1_Advanced_Debug,
  'E-INT-1_UVM_Formal': E_INT_1_UVM_Formal,
  'E-PERF-1_UVM_Performance': E_PERF_1_UVM_Performance,
  'E-SOC-1_SoC_Verification': E_SOC_1_SoC_Verification,
  'E-PSS-1_PSS': E_PSS_1_PSS,
  'E-PYUVM-1_Python_Verification': E_PYUVM_1_Python_Verification,
  'E-AI-1_AI_Driven_Verification': E_AI_1_AI_Driven_Verification,
  'E-RISCV-1_RISC_V_Verification': E_RISCV_1_RISC_V_Verification,
  'E-UVM-ML-1_Multi_Language': E_UVM_ML_1_Multi_Language,
  'E-EMU-1_Emulation': E_EMU_1_Emulation,
};

export default flashcardDecks;
