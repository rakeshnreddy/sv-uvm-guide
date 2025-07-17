import React from 'react';
import Link from 'next/link';
import { curriculumData } from '@/lib/curriculum-data';
import { Accordion, AccordionItem } from '@/components/ui/Accordion';

export default function CurriculumPage() {
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl font-bold text-accent font-sans mb-6 pb-2 border-b border-secondary">
        Learning Journey
      </h1>
      <p className="text-lg text-text-secondary font-body leading-relaxed mb-8">
        Navigate through the modules to master SystemVerilog and UVM.
      </p>
      <Accordion className="w-full">
        {curriculumData.map((module) => (
          <AccordionItem key={module.slug} title={module.title} id={module.slug}>
            <Accordion className="w-full">
              {module.sections.map((section) => (
                <AccordionItem key={section.slug} title={section.title} id={`${module.slug}-${section.slug}`}>
                  <ul className="space-y-2">
                    {section.topics.map((topic) => (
                      <li key={topic.slug}>
                        <Link
                          href={`/curriculum/${module.slug}/${section.slug}/${topic.slug}`}
                          className="text-text-primary hover:text-accent transition-colors"
                        >
                          {topic.title}
                        </Link>
                        <p className="text-text-secondary text-sm">{topic.description}</p>
                      </li>
                    ))}
                  </ul>
                </AccordionItem>
              ))}
            </Accordion>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
