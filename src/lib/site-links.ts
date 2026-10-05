/**
 * Site entry points shared by the navbar, the course outline, the home page
 * and the learner routes (src/lib/learning-paths.ts re-exports the last three).
 * Plain constants, safe to import from client components.
 */

/** The route chooser on the curriculum overview: Junior, Practitioner and Expert (G30-PATH-07, G30-SIDE-05). */
export const START_HERE_HREF = "/curriculum#routes";

/** The labs section of the Practice Hub. Its id is the shared heading slug of "Labs". */
export const LABS_HREF = "/practice#labs";

/** The interview question banks (G30-PRAC-07). */
export const INTERVIEW_PREP_HREF = "/interview-prep";

/** The placement quiz, "Find your level". */
export const PLACEMENT_QUIZ_HREF = "/quiz/placement";

/** Every "Expert:" topic across the lessons. */
export const EXPERT_INDEX_HREF = "/curriculum/expert-index";
