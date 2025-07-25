import React from 'react';
import Link from 'next/link';
import { curriculumData } from '@/lib/curriculum-data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/Accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function CurriculumPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-primary tracking-tight">
          UVM Learning Path
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
          From the fundamentals of SystemVerilog to expert-level UVM techniques, this structured curriculum is your roadmap to becoming a verification master.
        </p>
      </div>

      <div className="space-y-8">
        {curriculumData.map((module, moduleIndex) => (
          <Card key={module.slug} className="bg-background/50 border-border/50 overflow-hidden">
            <CardHeader className="bg-primary/10">
              <CardTitle className="text-2xl sm:text-3xl text-primary font-bold">
                <span className="text-accent mr-4">T{moduleIndex + 1}</span>
                {module.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Accordion type="multiple" className="w-full">
                {module.sections.map((section) => (
                  <AccordionItem key={section.slug} value={section.slug} className="border-b-border/50">
                    <AccordionTrigger className="px-6 py-4 text-lg sm:text-xl hover:bg-primary/5">
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="bg-background/50">
                      <ul className="divide-y divide-border/30">
                        {section.topics.map((topic) => (
                          <li key={topic.slug}>
                            <Link
                              href={`/curriculum/${module.slug}/${section.slug}/${topic.slug}`}
                              className="block px-6 py-4 hover:bg-primary/10 transition-colors"
                            >
                              <h4 className="font-semibold text-primary">{topic.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
