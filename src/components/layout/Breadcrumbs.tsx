"use client";

import Link from "next/link";
import { getBreadcrumbs } from "@/lib";
import { ChevronRight } from "lucide-react";

type BreadcrumbsProps = {
  slug: string[];
};

export default function Breadcrumbs({ slug }: BreadcrumbsProps) {
  const breadcrumbs = getBreadcrumbs(slug);

  return (
    <nav className="flex items-center text-sm text-muted-foreground mb-4">
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={breadcrumb.path} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 mx-1" />}
          <Link
            href={breadcrumb.path}
            className={`hover:text-foreground ${
              index === breadcrumbs.length - 1 ? "text-foreground font-semibold" : ""
            }`}
          >
            {breadcrumb.title}
          </Link>
        </div>
      ))}
    </nav>
  );
}
