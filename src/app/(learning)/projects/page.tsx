import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { InfoPage } from '@/components/templates/InfoPage';
import { LABS_HREF } from '@/lib/site-links';

import { resolveProjects, type ResolvedProject } from './resolve-projects';

/*
 * Project briefs, one per milestone on the ladder (M0-M8). The page is public
 * and listed in the sitemap and the footer.
 *
 * The page is static: there is no learner-store repository for projects, so
 * it keeps no progress.
 */

export const metadata: Metadata = {
  title: 'Projects',
  description:
    'Nine testbench projects, one for each milestone from a self-checking directed testbench to a subsystem capstone: the design under test, required features, acceptance criteria, preparing lessons and labs, and an honest effort estimate.',
};

const linkClass =
  'rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const sectionHeading = 'mt-12 mb-3 text-h2 text-foreground';
const subHeading = 'mt-6 mb-2 text-h3 text-foreground';

function ProjectSection({ project }: { project: ResolvedProject }) {
  const headingId = `${project.anchor}-heading`;
  return (
    <section id={project.anchor} aria-labelledby={headingId} className="scroll-mt-24">
      <h2 id={headingId} className={sectionHeading}>
        <span className="mr-2 font-mono font-medium text-muted-foreground [font-variant-ligatures:none]">{project.milestone}</span>
        {project.name}
      </h2>
      <dl className="not-prose grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-foreground">Effort</dt>
        <dd>{project.effort}</dd>
        <dt className="font-semibold text-foreground">Tools</dt>
        <dd>{project.tools}</dd>
      </dl>

      <p className="mt-4">
        <strong>Goal.</strong> {project.goal}
      </p>

      <h3 className={subHeading}>Design under test: {project.dut.name}</h3>
      <p>{project.dut.description}</p>

      <h3 className={subHeading}>Required features</h3>
      <ul>
        {project.requiredFeatures.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <h3 className={subHeading}>Acceptance criteria</h3>
      <ol>
        {project.acceptance.map((criterion) => (
          <li key={criterion}>{criterion}</li>
        ))}
      </ol>

      <h3 className={subHeading}>Prepare with</h3>
      <p className="mb-1 text-xs font-medium text-subtle">Lessons</p>
      <ul>
        {project.lessonLinks.map((lesson) => (
          <li key={lesson.ref}>
            <Link href={lesson.href} className={linkClass}>
              {lesson.code}: {lesson.isModuleIndex ? lesson.moduleTitle : `${lesson.moduleTitle}, ${lesson.title}`}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mb-1 text-xs font-medium text-subtle">Labs</p>
      <ul>
        {project.labItems.map((lab) => (
          <li key={lab.id}>
            {lab.href ? (
              <Link href={lab.href} className={linkClass}>
                {lab.title}
              </Link>
            ) : (
              <span>
                {lab.title} <span className="text-muted-foreground">(lab coming soon)</span>
              </span>
            )}
          </li>
        ))}
      </ul>

      <h3 className={subHeading}>Stretch goals</h3>
      <ul>
        {project.stretch.map((goal) => (
          <li key={goal}>{goal}</li>
        ))}
      </ul>

      {project.sources && project.sources.length > 0 ? (
        <>
          <h3 className={subHeading}>Specification references</h3>
          <ul className="text-sm">
            {project.sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

export default function ProjectsPage() {
  const projects = resolveProjects();

  return (
    <InfoPage gutter={false}
      title="Projects"
      description="One testbench project for each milestone, from a self-checking directed testbench to a subsystem capstone."
    >
      <p className="text-muted-foreground">
        Lessons and labs teach one idea at a time. A project asks you to put several together with no starter code:
        you write the design under test (DUT), the testbench (TB) and the checks, then prove the TB works by breaking
        the DUT on purpose and watching it fail.
      </p>

      <section aria-labelledby="how-to-use">
        <h2 id="how-to-use" className={sectionHeading}>
          How to use these briefs
        </h2>
        <ul>
          <li>
            Each project matches one milestone on the ladder used by the learning routes. Do the lessons and labs listed
            under <strong>Prepare with</strong> first.
          </li>
          <li>
            Nothing on this site runs or grades a project. You check your own work against the{' '}
            <strong>acceptance criteria</strong>, so treat each one as a test you must be able to show passing.
          </li>
          <li>
            Most briefs list mutants: small bugs you plant in the DUT or the TB. A TB that passes the clean DUT but
            misses a mutant is not done.
          </li>
          <li>
            Effort estimates assume you have finished the preparing lessons. Expect to spend longer the first time
            you set up a simulator.
          </li>
          <li>
            Later projects reuse earlier ones (the M2 agent returns in M5, the M3 scoreboard in M4 and M8), so keep
            each one in version control.
          </li>
        </ul>
        <p>
          The labs are on the <Link href={LABS_HREF} className={linkClass}>Practice hub</Link>; a lab marked coming
          soon cannot be opened yet.
        </p>
      </section>

      <nav aria-labelledby="milestone-ladder" className="not-prose mt-10">
        <h2 id="milestone-ladder" className="mb-3 text-h2 text-foreground">
          The milestone ladder
        </h2>
        <ol className="space-y-2">
          {projects.map((project) => (
            <li key={project.milestone} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-8 shrink-0 font-mono text-sm font-medium tabular-nums text-muted-foreground">{project.milestone}</span>
              <a href={`#${project.anchor}`} className={linkClass}>
                {project.name}
              </a>
              <span className="text-sm text-muted-foreground">{project.effort}</span>
            </li>
          ))}
        </ol>
      </nav>

      {projects.map((project) => (
        <ProjectSection key={project.milestone} project={project} />
      ))}

      <section aria-labelledby="project-layout">
        <h2 id="project-layout" className={sectionHeading}>
          A layout that works for every project
        </h2>
        <p>
          Keep the DUT, the TB and the mutants apart so that one command can run the clean DUT and every mutant:
        </p>
        <pre>
          <code>{`my-project/
  dut/        the design under test
  mutants/    one file (or define) per planted bug
  tb/         interface, packages, top module tb_top
  sim/        run script: clean run, then each mutant
  README.md   goal, how to run, results, what you learned`}</code>
        </pre>
        <p>
          Record each run in the README: the command, the seed and the final summary line. That log is your evidence
          that the acceptance criteria pass.
        </p>
      </section>
    </InfoPage>
  );
}
