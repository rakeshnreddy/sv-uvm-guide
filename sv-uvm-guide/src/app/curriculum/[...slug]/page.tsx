import { promises as fs } from 'fs';
import path from 'path';
import { compileMDX } from 'next-mdx-remote/rsc';
import grayMatter from 'gray-matter';
import Link from 'next/link';

import {
  curriculumData,
  getAllCurriculumNodes,
  findNodeByPath,
  getBreadcrumbs,
  getNextPrevLessons,
  type CurriculumNode,
} from '@/lib/curriculum-data';
import Breadcrumbs from '@/app/components/layout/Breadcrumbs';
import Button from '@/app/components/ui/Button';
import { CodeBlock } from '@/app/components/ui/CodeBlock'; // Assuming CodeBlock is suitable for MDX
import { Card } from '@/app/components/ui/Card';


// Define components to be used in MDX
const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="text-3xl font-bold my-4 text-primary-text" {...props} />,
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="text-2xl font-semibold my-3 text-primary-text" {...props} />,
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="text-xl font-semibold my-2 text-primary-text" {...props} />,
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="my-4 leading-relaxed" {...props} />,
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => <ul className="list-disc list-inside my-4 pl-4" {...props} />,
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => <ol className="list-decimal list-inside my-4 pl-4" {...props} />,
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="mb-2" {...props} />,
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    // This handles inline code. For code blocks, we'll use the CodeBlock component via remark/rehype plugins or explicit use.
    // If `rehype-pretty-code` is used as a plugin with `compileMDX`, it might transform ``` ``` blocks automatically.
    // For this example, inline code gets basic styling.
    return <code className="bg-gray-700 text-accent px-1 py-0.5 rounded text-sm font-mono" {...props} />;
  },
  // We can map actual ``` ``` language blocks to our CodeBlock component
  // This is typically done via rehype plugins when processing MDX.
  // For now, if MDX contains <CodeBlock code="..." language="...", this would work.
  // Or, we can use a rehype plugin to transform fenced code blocks.
  CodeBlock, // Makes <CodeBlock code="..." language=".." /> usable in MDX
  Button,    // Makes <Button> usable in MDX if needed
  Card,      // Makes <Card> usable in MDX
};


export async function generateStaticParams() {
  const allNodes = getAllCurriculumNodes(curriculumData);
  // Filter out parent nodes that have children, only generate pages for leaf nodes or nodes intended to have content
  const contentPages = allNodes.filter(node => {
    // Logic to determine if a node should have a page:
    // 1. It's a leaf node (no children)
    // 2. Or, it's a node that is explicitly planned to have content (e.g. introduction pages for sections)
    // For this setup, we assume all defined paths in curriculumData might have a corresponding .mdx file.
    // The prompt implies all nodes in curriculumData could be pages.
    return true; // For now, assume all nodes can be pages.
  });

  return contentPages.map((node) => ({
    slug: node.path.replace('/curriculum/', '').split('/'),
  }));
}

async function getPageContent(slug: string[]) {
  const currentPath = `/curriculum/${slug.join('/')}`;
  const node = findNodeByPath(curriculumData, currentPath);

  if (!node) {
    return null;
  }

  const filePath = path.join(process.cwd(), 'content', 'curriculum', ...slug) + '.mdx';

  try {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const { content, data: frontmatter } = grayMatter(rawContent);

    const { content: compiledContent } = await compileMDX<{ title: string }>({
      source: content,
      components: mdxComponents,
      options: {
        parseFrontmatter: false, // Already parsed by gray-matter
        mdxOptions: {
          // remarkPlugins: [],
          rehypePlugins: [
            // Add rehypePrettyCode here if not handled by CodeBlock component directly for MDX fenced blocks
            // Example: [rehypePrettyCode, { theme: 'github-dark' }]
            // However, our CodeBlock component does its own rehype processing.
            // For MDX fenced code blocks to automatically use it, a custom rehype plugin would be needed
            // to replace `pre/code` elements with calls to our `CodeBlock` component.
            // For simplicity, MDX files can explicitly use `<CodeBlock code="..." />`
          ],
        },
      },
    });

    return { node, frontmatter, compiledContent };
  } catch (error) {
    console.error(`Error reading or compiling MDX for ${currentPath}:`, error);
    // If file not found, it's okay, might be a category page without its own MDX
    // but for this prompt, we expect MDX for each page.
    return { node, frontmatter: { title: node.title }, compiledContent: <p>Content not found for this page.</p> };
  }
}

export default async function CurriculumPage({ params }: { params: { slug: string[] } }) {
  const data = await getPageContent(params.slug);

  if (!data || !data.node) {
    return <div className="container mx-auto px-4 py-8 text-red-500">Page not found.</div>;
  }

  const { node, frontmatter, compiledContent } = data;
  const breadcrumbNodes = getBreadcrumbs(curriculumData, node.path);
  const allNodesFlat = getAllCurriculumNodes(curriculumData);
  const { prev, next } = getNextPrevLessons(allNodesFlat, node.path);

  return (
    <div className="container mx-auto px-4 py-8 text-primary-text">
      <Breadcrumbs nodes={breadcrumbNodes} />
      <article className="prose prose-invert max-w-none lg:prose-xl">
        <h1 className="text-4xl font-bold mb-8 text-accent">{frontmatter.title || node.title}</h1>

        {/* Render the compiled MDX content */}
        {compiledContent}

      </article>

      <div className="mt-12 pt-8 border-t border-[rgba(100,255,218,0.2)]">
        <h3 className="text-xl font-semibold mb-4">End-of-Lesson Actions</h3>
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <Button variant="primary" onClick={() => alert('Add to Memory Hub clicked (not implemented)')}>
            Add to Memory Hub
          </Button>
          <Button variant="secondary" onClick={() => alert('Explain in Notebook clicked (not implemented)')}>
            Explain in Notebook
          </Button>
          <Button variant="secondary" onClick={() => alert('Practice this Concept clicked (not implemented)')}>
            Practice this Concept
          </Button>
        </div>
      </div>

      {(prev || next) && (
        <div className="mt-12 pt-8 border-t border-[rgba(100,255,218,0.2)] flex justify-between items-center">
          {prev ? (
            <Link href={prev.path} passHref>
              <Button variant="secondary">
                &larr; Previous: {prev.title}
              </Button>
            </Link>
          ) : <div /> /* Placeholder for spacing if no prev */}
          {next ? (
            <Link href={next.path} passHref>
              <Button variant="primary">
                Next: {next.title} &rarr;
              </Button>
            </Link>
          ) : <div /> /* Placeholder for spacing if no next */}
        </div>
      )}
    </div>
  );
}

// Optional: Metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string[] } }) {
  const currentPath = `/curriculum/${params.slug.join('/')}`;
  const node = findNodeByPath(curriculumData, currentPath);
  if (!node) {
    return { title: 'Page Not Found' };
  }
  return {
    title: `${node.title} | SV/UVM Guide`,
    // description: node.description || `Learn about ${node.title} in SystemVerilog and UVM.`,
  };
}
