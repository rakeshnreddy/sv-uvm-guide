import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Section } from '@/components/layout/Section';
import { InfoPage } from '@/components/templates/InfoPage';
import { Prose } from '@/components/ui/Prose';
import { SignalTag } from '@/components/ui/SignalTag';
import { siteLabel } from '@/lib/nav-labels';
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
  title: siteLabel('/projects'),
  description:
    'Nine testbench projects, one for each milestone from a self-checking directed testbench to a subsystem capstone: the design under test, required features, acceptance criteria, preparing lessons and labs, and an honest effort estimate.',
};

const linkClass =
  'rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const subHeading = 'mt-6 mb-2 text-h3 text-foreground';

function ProjectSection({ project }: { project: ResolvedProject }) {
  return (
    <Section
      id={project.anchor}
      title={
        <>
          <SignalTag code={project.milestone} className="mr-1 align-middle" />{' '}
          {project.name}
        </>
      }
    >
      <dl className="not-prose grid gap-x-6 gap-y-1 text-sm text-muted-foreground sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-foreground">Effort</dt>
        <dd>{project.effort}</dd>
        <dt className="font-semibold text-foreground">Tools</dt>
        <dd>{project.tools}</dd>
      </dl>

      <Prose className="mt-4">
        <p>
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
      </Prose>
    </Section>
  );
}

export default function ProjectsPage() {
  const projects = resolveProjects();

  return (
    <InfoPage
      width="reading"
      prose={false}
      title={siteLabel('/projects')}
      description="One testbench project for each milestone, from a self-checking directed testbench to a subsystem capstone."
    >
      <Prose>
        <p>
          Lessons and labs teach one idea at a time. A project asks you to put several together with no starter code:
          you write the design under test (DUT), the testbench (TB) and the checks, then prove the TB works by breaking
          the DUT on purpose and watching it fail.
        </p>
      </Prose>

      <Section id="how-to-use" title="How to use these briefs">
        <Prose>
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
        </Prose>
      </Section>

      <Section id="milestone-ladder" title="The milestone ladder">
        <nav aria-label="Milestone ladder">
          <ol className="space-y-2">
            {projects.map((project) => (
              <li key={project.milestone} className="flex flex-wrap items-baseline gap-x-3">
                <span className="w-8 shrink-0">
                  <SignalTag code={project.milestone} />
                </span>
                <a href={`#${project.anchor}`} className={linkClass}>
                  {project.name}
                </a>
                <span className="text-sm text-muted-foreground">{project.effort}</span>
              </li>
            ))}
          </ol>
        </nav>
      </Section>

      {projects.map((project) => (
        <ProjectSection key={project.milestone} project={project} />
      ))}

      <Section id="project-layout" title="A layout that works for every project">
        <Prose>
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
        </Prose>
      </Section>
    </InfoPage>
  );
}
