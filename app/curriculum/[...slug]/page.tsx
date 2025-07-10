import { curriculumData, CurriculumNode } from '@/lib/curriculum-data'; // Assuming @ is configured for src alias
// import Button from '@/app/components/ui/Button'; // Assuming Button component path

// Helper function to recursively collect all slugs
function getAllSlugs(node: CurriculumNode): { slug: string[] }[] {
  let slugs: { slug: string[] }[] = [];
  if (node.path && node.path.startsWith('/curriculum/')) {
    const pathParts = node.path.replace('/curriculum/', '').split('/');
    if (pathParts.length > 0 && pathParts[0] !== '') { // Ensure it's a valid topic page
      slugs.push({ slug: pathParts });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      slugs = slugs.concat(getAllSlugs(child));
    }
  }
  return slugs;
}

export async function generateStaticParams() {
  // Check if curriculumData and its children are defined
  if (!curriculumData || !curriculumData.children) {
    console.warn("curriculumData or its children are not defined. Skipping generateStaticParams for curriculum pages.");
    return [];
  }
  const allPaths = getAllSlugs(curriculumData);
  return allPaths;
}

// Helper function to find a curriculum node by slug
function findNodeBySlug(slug: string[], node: CurriculumNode): CurriculumNode | null {
  if (!node) return null;

  const currentPath = node.path.replace('/curriculum/', '');
  const slugPath = slug.join('/');

  if (currentPath === slugPath) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findNodeBySlug(slug, child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

// Placeholder for Breadcrumbs component
const Breadcrumbs = ({ path }: { path: string }) => {
  // Logic to generate breadcrumbs from the path
  const parts = path.split('/').filter(part => part);
  let currentPath = '';
  return (
    <nav aria-label="breadcrumb">
      <ol style={{ listStyle: 'none', padding: 0, display: 'flex' }}>
        <li><a href="/curriculum">Curriculum</a></li>
        {parts.slice(1).map((part, index) => {
          currentPath += `/${part}`;
          const isLast = index === parts.length - 2;
          return (
            <li key={part} style={{ marginLeft: '8px' }}>
              <span style={{ marginRight: '8px' }}>/</span>
              {isLast ? (
                <span>{part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              ) : (
                <a href={`/curriculum${currentPath}`}>{part.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};


export default function CurriculumPage({ params }: { params: { slug: string[] } }) {
  const { slug } = params;
  if (!slug || slug.length === 0) {
    return <div>Invalid page path.</div>;
  }

  const node = findNodeBySlug(slug, curriculumData);

  if (!node) {
    return <div>Page not found.</div>;
  }

  // Placeholder for MDX content fetching and rendering
  const mdxContent = `Placeholder for MDX content for ${node.title}. Content will be fetched from /content${node.path}.mdx`;

  // Placeholder for Next/Previous lesson logic
  const previousLesson = null; // findPreviousLesson(node, curriculumData);
  const nextLesson = null; // findNextLesson(node, curriculumData);

  return (
    <div style={{ padding: '20px' }}>
      <Breadcrumbs path={node.path} />
      <h1 style={{ marginTop: '20px', marginBottom: '20px' }}>{node.title}</h1>

      {/* MDX Content Area */}
      <article style={{ marginBottom: '30px', border: '1px solid #eee', padding: '15px' }}>
        <p>{mdxContent}</p>
        {/* Actual MDX rendering will replace the above paragraph */}
      </article>

      {/* End-of-Lesson Actions */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '30px',
        padding: '15px',
        border: '1px solid #ddd',
        backgroundColor: '#f9f9f9'
      }}>
        {/* Replace with actual Button components */}
        <button>Add to Memory Hub</button>
        <button>Explain in Notebook</button>
        <button>Practice this Concept</button>
        {/* Example using the imported Button if available:
        <Button variant="secondary">Add to Memory Hub</Button>
        <Button variant="secondary">Explain in Notebook</Button>
        <Button variant="primary">Practice this Concept</Button>
        */}
      </div>

      {/* Next/Previous Lesson Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {previousLesson ? (
          <a href={previousLesson.path} style={{ textDecoration: 'none', color: 'blue' }}>
            &larr; Previous: {previousLesson.title}
          </a>
        ) : (
          <span>&nbsp;</span> // Placeholder to maintain layout
        )}
        {nextLesson ? (
          <a href={nextLesson.path} style={{ textDecoration: 'none', color: 'blue' }}>
            Next: {nextLesson.title} &rarr;
          </a>
        ) : (
          <span>&nbsp;</span> // Placeholder to maintain layout
        )}
      </div>
    </div>
  );
}
