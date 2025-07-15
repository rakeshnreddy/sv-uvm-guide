import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  curriculumData,
  getAllCurriculumNodes,
  findNodeByPath,
  getBreadcrumbs,
  getNextPrevLessons
} from '@/lib/curriculum-data';
import { notFound } from 'next/navigation';
import { createFlashcard } from '@/app/actions/srs';
import { createNotebookEntry } from '@/app/actions/notebook';
import { Button } from '@/app/components/ui/Button';

type CurriculumTopicPageProps = {
  params: { slug: string[] };
};

export async function generateStaticParams() {
  const allNodes = getAllCurriculumNodes(curriculumData);
  const paths = allNodes
    .map(node => {
      const slugParts = node.path.startsWith('/curriculum/')
        ? node.path.substring('/curriculum/'.length).split('/')
        : [];
      return { slug: slugParts.filter(p => p.length > 0) };
    })
    .filter(p => p.slug.length > 0);

  return paths;
}

const TopicBreadcrumbs = ({ path: currentPath }: { path: string }) => {
  const breadcrumbNodes = getBreadcrumbs(curriculumData, currentPath);

  return (
    <nav aria-label="breadcrumb" className="mb-6 text-sm text-brand-text-primary/80">
      <ol className="list-none p-0 inline-flex space-x-2 items-center flex-wrap">
        <li>
          <Link href="/curriculum" className="text-accent hover:underline">
            Curriculum
          </Link>
        </li>
        {breadcrumbNodes.map((node, index) => (
          <li key={node.id} className="inline-flex items-center">
            <span className="mx-2">/</span>
            {index === breadcrumbNodes.length - 1 ? (
              <span className="font-semibold text-brand-text-primary">{node.title}</span>
            ) : (
              <Link href={node.path} className="text-accent hover:underline">
                {node.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default async function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = params;

  if (!slug || slug.length === 0) {
    notFound();
  }

  const currentPath = `/curriculum/${slug.join('/')}`;
  const node = findNodeByPath(curriculumData, currentPath);

  if (!node) {
    notFound();
  }

  const flatNodes = getAllCurriculumNodes(curriculumData);
  const { prev: prevLesson, next: nextLesson } = getNextPrevLessons(flatNodes, currentPath);

  const mdxPath = path.join(process.cwd(), 'content', node.path + '.mdx');
  let mdxContent;
  try {
    mdxContent = await fs.readFile(mdxPath, 'utf8');
  } catch (error) {
    notFound();
  }

  return (
    <div>
      <TopicBreadcrumbs path={node.path} />

      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-border">
        {node.title}
      </h1>

      <article className="prose prose-invert max-w-none
                          prose-headings:text-accent prose-a:text-accent prose-strong:text-brand-text-primary
                          prose-code:text-secondary-accent prose-code:bg-slate-800/80 prose-code:p-1 prose-code:rounded
                          prose-pre:bg-slate-800/80 prose-pre:p-4 prose-pre:rounded-md
                          my-8 p-6 bg-background/70 dark:bg-slate-800/60 backdrop-blur-xs border border-slate-700/50 rounded-lg">
        <MDXRemote source={mdxContent} />
      </article>

      <div className="my-8 p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg flex flex-wrap gap-4 justify-center">
        <form action={async () => {
          'use server';
          await createFlashcard(node.id);
        }}>
          <Button type="submit">Add to Memory Hub</Button>
        </form>
        <form action={async () => {
          'use server';
          await createNotebookEntry(node.id, node.title);
        }}>
          <Button type="submit" variant="secondary">
            Explain in Notebook
          </Button>
        </form>
        <Button variant="ghost">Practice this Concept</Button>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-12 pt-6 border-t border-border gap-4">
        {prevLesson ? (
          <Link href={prevLesson.path} className="block text-center sm:text-left w-full sm:w-auto px-4 py-3 text-brand-text-primary hover:text-accent bg-slate-800/60 hover:bg-slate-700/80 transition-colors rounded-md border border-border hover:border-accent">
            <span className="text-xs block text-brand-text-primary/70">&larr; Previous Lesson</span>
            {prevLesson.title}
          </Link>
        ) : (
          <div className="w-full sm:w-auto"/>
        )}
        {nextLesson ? (
          <Link href={nextLesson.path} className="block text-center sm:text-right w-full sm:w-auto px-4 py-3 text-brand-text-primary hover:text-accent bg-slate-800/60 hover:bg-slate-700/80 transition-colors rounded-md border border-border hover:border-accent">
            <span className="text-xs block text-brand-text-primary/70">Next Lesson &rarr;</span>
            {nextLesson.title}
          </Link>
        ) : (
          <div className="w-full sm:w-auto"/>
        )}
      </div>
    </div>
  );
}
