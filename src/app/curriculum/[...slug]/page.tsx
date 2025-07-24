import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { findTopicBySlug, getBreadcrumbs } from '@/lib/curriculum-data';
import { notFound } from 'next/navigation';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import FeynmanPromptWidget from '@/components/widgets/FeynmanPromptWidget';
import InteractiveCode from '@/components/ui/InteractiveCode';
import Quiz from '@/components/ui/Quiz';
import Panel from '@/components/ui/Panel';
import { InfoPage } from '@/components/templates/InfoPage';
import UvmHeroDiagram from '@/components/UvmHeroDiagram';

type CurriculumTopicPageProps = {
  params: Promise<{ slug: string[] }>;
};

const components = {
  InteractiveCode,
  Quiz,
  Panel,
  InfoPage,
  UvmHeroDiagram,
};

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    notFound();
  }

  const topic = findTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const mdxPath = path.join(
    process.cwd(),
    'content',
    'curriculum',
    ...slug
  ) + '.mdx';
  let mdxContent;
  try {
    mdxContent = await fs.readFile(mdxPath, 'utf8');
  } catch (error) {
    notFound();
  }

  return (
    <div className="p-4 md:p-6 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg shadow-lg">
      <Breadcrumbs slug={slug} />
      <h1 className="text-3xl sm:text-4xl font-bold text-primary font-sans mb-6 pb-2 border-b border-white/20">
        {topic.title}
      </h1>
      <article className="prose prose-invert max-w-none">
        <MDXRemote source={mdxContent} components={components} />
      </article>
      <FeynmanPromptWidget conceptTitle={topic.title} />
    </div>
  );
}
