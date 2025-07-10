import Link from 'next/link';
import type { CurriculumNode } from '@/lib/curriculum-data'; // Adjust path as needed

interface BreadcrumbsProps {
  nodes: CurriculumNode[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ nodes }) => {
  if (!nodes || nodes.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-400">
      <ol className="list-none p-0 inline-flex space-x-2">
        <li className="flex items-center">
          <Link href="/curriculum" className="hover:text-accent">
            Curriculum
          </Link>
        </li>
        {nodes.map((node, index) => (
          <li key={node.id} className="flex items-center">
            <span className="mx-2">/</span>
            {index === nodes.length - 1 ? (
              <span className="text-primary-text font-semibold" aria-current="page">
                {node.title}
              </span>
            ) : (
              <Link href={node.path} className="hover:text-accent">
                {node.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
