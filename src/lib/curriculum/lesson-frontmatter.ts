import { z } from "zod";

const lessonSourceSchema = z.object({
  title: z.string().trim().min(1),
  type: z.string().trim().min(1),
  identifier: z.string().trim().min(1).optional(),
  version: z.union([z.string().trim().min(1), z.number()]).optional(),
}).strict();

export const lessonFrontmatterSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  flashcardId: z.string().trim().min(1).optional(),
  flashcards: z.string().trim().min(1).optional(),
  // Automatic concept links are off unless a lesson opts in: the knowledge graph
  // behind them is a 15-node placeholder with wrong tiers (G30 request 10).
  conceptLinking: z.boolean().default(false),
  components: z.array(z.string().trim().min(1)).default([]),
  order: z.number().int().positive().optional(),
  tier: z.string().trim().min(1).optional(),
  sources: z.array(lessonSourceSchema).default([]),
}).strict();

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export function parseLessonFrontmatter(value: unknown): LessonFrontmatter {
  return lessonFrontmatterSchema.parse(value);
}
