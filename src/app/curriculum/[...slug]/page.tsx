import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { findTopicBySlug, getBreadcrumbs } from '@/lib/curriculum-data';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/app/components/layout/Breadcrumbs';
import FeynmanPromptWidget from '@/components/widgets/FeynmanPromptWidget';

type CurriculumTopicPageProps = {
  params: { slug: string[] };
};

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = params;

  if (!slug || slug.length === 0) {
    notFound();
  }

  const topic = findTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const mdxPath = path.join(process.cwd(), 'content', 'curriculum', ...slug) + '.mdx';
  let mdxContent;
  try {
    mdxContent = await fs.readFile(mdxPath, 'utf8');
  } catch (error) {
    // It's possible the file doesn't exist, so we'll just render the title
    mdxContent = `# ${topic.title}\n\nContent coming soon...`;
  }

  return (
    <div>
      <Breadcrumbs slug={slug} />
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-secondary">
        {topic.title}
      </h1>
      <article className="prose prose-invert max-w-none">
        <MDXRemote source={mdxContent} />
      </article>
      <FeynmanPromptWidget topicTitle={topic.title} />
    </div>
  );
}
