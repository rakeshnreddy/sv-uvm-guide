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
  conceptLinking: z.boolean().default(true),
  components: z.array(z.string().trim().min(1)).default([]),
  order: z.number().int().positive().optional(),
  tier: z.string().trim().min(1).optional(),
  sources: z.array(lessonSourceSchema).default([]),
}).strict();

export type LessonFrontmatter = z.infer<typeof lessonFrontmatterSchema>;

export function parseLessonFrontmatter(value: unknown): LessonFrontmatter {
  return lessonFrontmatterSchema.parse(value);
}
