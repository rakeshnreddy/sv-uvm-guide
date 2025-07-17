import Link from 'next/link';
import { getBreadcrumbs } from '@/lib/curriculum-data';

interface BreadcrumbsProps {
  slug: string[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ slug }) => {
  const breadcrumbs = getBreadcrumbs(slug);

  if (!breadcrumbs || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-sm text-text-secondary">
      <ol className="list-none p-0 inline-flex space-x-2">
        <li className="flex items-center">
          <Link href="/curriculum" className="hover:text-accent">
            Curriculum
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center">
            <span className="mx-2">/</span>
            {index === breadcrumbs.length - 1 ? (
              <span className="text-text-primary font-semibold" aria-current="page">
                {crumb.title}
              </span>
            ) : (
              <Link href={crumb.path} className="hover:text-accent">
                {crumb.title}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
