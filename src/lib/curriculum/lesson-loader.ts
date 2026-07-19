import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import type { Metadata } from "next";

import {
  curriculumData,
  findPrevNextTopics,
  findTopicBySlug,
  normalizeSlug,
  type Topic,
} from "@/lib/curriculum-data";

import { parseLessonFrontmatter, type LessonFrontmatter } from "./lesson-frontmatter";

export interface CurriculumLesson {
  content: string;
  frontmatter: LessonFrontmatter;
  navigation: ReturnType<typeof findPrevNextTopics>;
  normalizedSlug: [string, string, string];
  topic: Topic;
}

const loadCurriculumLessonByKey = cache(
  async (slugKey: string): Promise<CurriculumLesson | null> => {
    const normalized = normalizeSlug(slugKey.split("/"));
    if (normalized.length !== 3) return null;

    const topic = findTopicBySlug(normalized);
    if (!topic) return null;

    const normalizedSlug: [string, string, string] = [
      normalized[0],
      normalized[1],
      normalized[2],
    ];
    const lessonPath = path.join(
      process.cwd(),
      "content",
      "curriculum",
      normalizedSlug[0],
      normalizedSlug[1],
      `${normalizedSlug[2]}.mdx`,
    );

    try {
      const file = await fs.readFile(lessonPath, "utf8");
      const parsed = matter(file);
      return {
        content: parsed.content,
        frontmatter: parseLessonFrontmatter(parsed.data),
        navigation: findPrevNextTopics(normalizedSlug),
        normalizedSlug,
        topic,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
);

export function loadCurriculumLesson(rawSlug: readonly string[]): Promise<CurriculumLesson | null> {
  return loadCurriculumLessonByKey(rawSlug.join("/"));
}

export function generateCurriculumStaticParams(): Array<{ slug: string[] }> {
  return curriculumData.flatMap((courseModule) =>
    courseModule.sections.flatMap((section) =>
      section.topics.map((topic) => ({
        slug: [courseModule.slug, section.slug, topic.slug],
      })),
    ),
  );
}

export function generateLessonMetadata(lesson: CurriculumLesson): Metadata {
  const title = lesson.frontmatter.title ?? lesson.topic.title;
  const description = lesson.frontmatter.description ?? lesson.topic.description;
  const canonical = `/curriculum/${lesson.normalizedSlug.map(encodeURIComponent).join("/")}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
  };
}
