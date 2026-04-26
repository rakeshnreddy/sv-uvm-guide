/**
 * Reusable interview-bank schema for SV/UVM/AMBA curriculum.
 * Every question has a rubric and model answer to support
 * self-study, mock-interview drills, and interviewer prep.
 */

export type InterviewLevel = 'junior' | 'mid' | 'senior' | 'staff' | 'senior-staff';

export type InterviewCategory =
  | 'concept'
  | 'waveform-debug'
  | 'coding'
  | 'verification-plan'
  | 'trick'
  | 'staff-system-design';

export interface InterviewQuestion {
  /** Unique identifier across all banks */
  id: string;
  /** Topic family: sv, uvm, sva, debug, soc, amba */
  topic: string;
  /** Target engineer level */
  level: InterviewLevel;
  /** Question category */
  category: InterviewCategory;
  /** The interview prompt as asked to the candidate */
  prompt: string;
  /** What a strong answer should cover */
  rubric: string;
  /** A concise model answer */
  model_answer: string;
  /** Primary/secondary source references */
  sources: string[];
}

export interface InterviewBank {
  /** Unique bank identifier */
  id: string;
  /** Human-readable bank title */
  title: string;
  /** Brief description of what the bank covers */
  description: string;
  /** Topic family */
  topic: string;
  /** Questions in this bank */
  questions: InterviewQuestion[];
}
