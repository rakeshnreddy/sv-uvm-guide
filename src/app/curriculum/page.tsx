import React from 'react';
import Link from 'next/link';
import { curriculumData } from '@/lib/curriculum-data';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export default function CurriculumPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl sm:text-4xl font-bold text-primary font-sans mb-6 pb-2 border-b border-white/20">
        Curriculum
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {curriculumData.map((module) => (
          <Card key={module.slug}>
            <CardHeader>
              <CardTitle>{module.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {module.sections.map((section) => (
                  <li key={section.slug} className="mb-2">
                    <h3 className="font-semibold">{section.title}</h3>
                    <ul className="ml-4">
                      {section.topics.map((topic) => (
                        <li key={topic.slug}>
                          <Link href={`/curriculum/${module.slug}/${section.slug}/${topic.slug}`} className="text-primary hover:underline">
                            {topic.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
