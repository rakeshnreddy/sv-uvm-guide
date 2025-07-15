import React from 'react';
import Link from 'next/link';
// Corrected import path for curriculum-data and its functions
import {
  curriculumData,
  CurriculumNode,
  getAllCurriculumNodes,
  findNodeByPath,
  getBreadcrumbs,
  getNextPrevLessons
} from '@/lib/curriculum-data';
import { notFound } from 'next/navigation'; // For 404 pages
import { createFlashcard } from '@/actions/srs';
import { createNotebookEntry } from '@/actions/notebook';

// Define the Props type for the page component
type CurriculumTopicPageProps = {
  params: { slug: string[] };
  // searchParams?: { [key: string]: string | string[] | undefined }; // Not used currently
};

// Generate static params using the helper from the actual curriculum-data.ts
export async function generateStaticParams() {
  const allNodes = getAllCurriculumNodes(curriculumData); // curriculumData is CurriculumNode[]

  // Filter for nodes that are actual pages (not just parent categories without their own content page if any)
  // and transform their paths into slug arrays.
  // All nodes in the current data structure are pages.
  const paths = allNodes
    .map(node => {
      // Remove '/curriculum/' prefix and split into segments
      const slugParts = node.path.startsWith('/curriculum/')
        ? node.path.substring('/curriculum/'.length).split('/')
        : [];
      return { slug: slugParts.filter(p => p.length > 0) }; // Ensure no empty slugs from trailing slashes etc.
    })
    .filter(p => p.slug.length > 0); // Only include paths that have actual slugs

  return paths;
}

// Custom Breadcrumbs component using Tailwind
const TopicBreadcrumbs = ({ path }: { path: string }) => {
  const breadcrumbNodes = getBreadcrumbs(curriculumData, path);

  return (
    <nav aria-label="breadcrumb" className="mb-6 text-sm text-brand-text-primary/80">
      <ol className="list-none p-0 inline-flex space-x-2 items-center flex-wrap"> {/* Added flex-wrap */}
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

export default function CurriculumTopicPage({ params }: CurriculumTopicPageProps) {
  const { slug } = params;

  if (!slug || slug.length === 0) {
    // This should ideally not be reached if generateStaticParams is correct
    // and Next.js routing works as expected for dynamic routes.
    notFound();
  }

  // Reconstruct the path from the slug to match the format in curriculumData
  const currentPath = `/curriculum/${slug.join('/')}`;
  const node = findNodeByPath(curriculumData, currentPath); // Use findNodeByPath from curriculum-data

  if (!node) {
    notFound(); // Triggers the 404 page
  }

  // Get Next/Previous lesson data
  const flatNodes = getAllCurriculumNodes(curriculumData);
  const { prev: prevLesson, next: nextLesson } = getNextPrevLessons(flatNodes, currentPath);

  // Placeholder for MDX content fetching and rendering
  const mdxContent = `This is a placeholder for the curriculum topic: "${node.title}". Actual content would be loaded from an MDX file corresponding to the path "${node.path}.mdx" (e.g., inside /content${node.path}.mdx). For now, enjoy this informative placeholder!`;

  return (
    // MainLayout already provides container, px, py for page content.
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
        {/*
          Using Tailwind Typography plugin for basic MDX styling.
          Actual MDX rendering (e.g. with next-mdx-remote) would go here.
        */}
        <p className="text-lg text-brand-text-primary/90 font-body leading-relaxed">
          {mdxContent}
        </p>
      </article>

      {/* End-of-Lesson Actions - Styled with Tailwind */}
      <div className="my-8 p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg flex flex-wrap gap-4 justify-center">
        <form action={async () => {
          'use server';
          await createFlashcard(node.id);
        }}>
          <button type="submit" className="px-6 py-2 bg-accent text-background font-semibold rounded-md hover:bg-accent/80 transition-colors">
            Add to Memory Hub
          </button>
        </form>
        <form action={async () => {
          'use server';
          await createNotebookEntry(node.id, node.title);
        }}>
          <button type="submit" className="px-6 py-2 bg-secondary-accent text-background font-semibold rounded-md hover:bg-secondary-accent/80 transition-colors">
            Explain in Notebook
          </button>
        </form>
        <button className="px-6 py-2 bg-sky-500 text-white font-semibold rounded-md hover:bg-sky-600 transition-colors">
          Practice this Concept
        </button>
      </div>

      {/* Next/Previous Lesson Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-12 pt-6 border-t border-border gap-4">
        {prevLesson ? (
          <Link href={prevLesson.path} className="block text-center sm:text-left w-full sm:w-auto px-4 py-3 text-brand-text-primary hover:text-accent bg-slate-800/60 hover:bg-slate-700/80 transition-colors rounded-md border border-border hover:border-accent">
            <span className="text-xs block text-brand-text-primary/70">&larr; Previous Lesson</span>
            {prevLesson.title}
          </Link>
        ) : (
          <div className="w-full sm:w-auto"/> // Empty div for spacing
        )}
        {nextLesson ? (
          <Link href={nextLesson.path} className="block text-center sm:text-right w-full sm:w-auto px-4 py-3 text-brand-text-primary hover:text-accent bg-slate-800/60 hover:bg-slate-700/80 transition-colors rounded-md border border-border hover:border-accent">
            <span className="text-xs block text-brand-text-primary/70">Next Lesson &rarr;</span>
            {nextLesson.title}
          </Link>
        ) : (
          <div className="w-full sm:w-auto"/> // Empty div for spacing
        )}
      </div>
    </div>
  );
}
