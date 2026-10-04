import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LessonLinkList, focusRing } from '@/components/practice/LearnInLesson';

import RevealAnswer from './RevealAnswer';
import {
  loadInterviewBanks,
  splitInlineCode,
  toRichBlocks,
  type InlinePart,
  type InterviewQuestion,
} from './interview-banks';

export const metadata: Metadata = {
  title: 'Interview Prep',
  description:
    'Interview questions on SystemVerilog, SVA and formal, UVM, AMBA, debug and SoC verification, from junior to senior staff, with model answers and links to the lessons that teach each topic.',
};

const eyebrow = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  systemverilog: 'SystemVerilog',
  sv: 'SystemVerilog',
  verilog: 'Verilog',
  python: 'Python',
  c: 'C',
  cpp: 'C++',
};

function languageName(language: string): string {
  return LANGUAGE_NAMES[language.toLowerCase()] ?? language;
}

function InlineText({ text = '', parts = splitInlineCode(text) }: { text?: string; parts?: InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.code ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground [font-variant-ligatures:none]"
          >
            {part.text}
          </code>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
      {toRichBlocks(text).map((block, index) =>
        block.type === 'code' ? (
          <pre
            key={index}
            // Scrollable code must be reachable from the keyboard; a named region lets screen readers announce it.
            tabIndex={0}
            role="region"
            aria-label={block.language === 'text' ? 'Code example' : `${languageName(block.language)} code example`}
            className={`overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[13px] leading-6 text-slate-100 [font-variant-ligatures:none] ${focusRing}`}
          >
            <code>{block.code}</code>
          </pre>
        ) : (
          <p key={index}>
            <InlineText parts={block.parts} />
          </p>
        ),
      )}
    </div>
  );
}

function TextList({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className={eyebrow}>{label}</p>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground [overflow-wrap:anywhere]">
        {items.map((item) => (
          <li key={item}>
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuestionCard({ question }: { question: InterviewQuestion }) {
  const promptId = `q-${question.id}-prompt`;
  return (
    <article
      id={`q-${question.id}`}
      aria-labelledby={promptId}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5"
    >
      <p className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border px-2 py-0.5 font-medium text-muted-foreground">
          {question.categoryLabel}
        </span>
      </p>
      <h4 id={promptId} className="mt-2 text-base font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
        <InlineText text={question.prompt} />
      </h4>
      {question.code ? (
        <div className="mt-3">
          {/* Plain code is wrapped in an unlabelled fence: the bank does not say which language it is. */}
          <RichText text={question.code.includes('```') ? question.code : `\`\`\`\n${question.code}\n\`\`\``} />
        </div>
      ) : null}
      <LessonLinkList lessons={question.lessons} label="Learn it in" className="mt-3" />
      <RevealAnswer>
        <div className="space-y-4 rounded-xl border border-border bg-muted/40 p-4">
          <div>
            <p className={eyebrow}>Model answer</p>
            <div className="mt-1.5">
              <RichText text={question.modelAnswer} />
            </div>
          </div>
          {question.rubric ? (
            <div>
              <p className={eyebrow}>What a strong answer covers</p>
              <div className="mt-1.5">
                <RichText text={question.rubric} />
              </div>
            </div>
          ) : null}
          <TextList label="Common mistakes" items={question.commonMistakes} />
          <TextList label="Follow-up questions" items={question.followUps} />
          {question.sources.length > 0 ? (
            <div>
              <p className={eyebrow}>Sources the bank cites</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {question.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </RevealAnswer>
    </article>
  );
}

export default function InterviewPrepPage() {
  const banks = loadInterviewBanks();
  const questionTotal = banks.reduce((sum, bank) => sum + bank.questionCount, 0);

  return (
    <div className="mx-auto w-full max-w-4xl pb-16">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <li>
            <Link href="/practice" className={`rounded-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}>
              Practice Hub
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Interview prep
          </li>
        </ol>
      </nav>

      <header className="mt-4 rounded-3xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Interview prep</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          {questionTotal} questions in {banks.length} banks, from junior to senior staff. Answer each one out loud or on paper
          first, then reveal the model answer and check yourself against what a strong answer covers.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          The banks are being reviewed against the standards. Where a model answer disagrees with a lesson, follow the lesson
          and the clause it cites.
        </p>
      </header>

      <nav aria-label="Interview banks" className="mt-6">
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
          {banks.map((bank) => (
            <li key={bank.id}>
              <a
                href={`#${bank.anchor}`}
                className={`flex h-full min-h-[44px] flex-col justify-center rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-muted ${focusRing}`}
              >
                <span className="font-semibold text-primary">{bank.title}</span>
                <span className="text-xs text-muted-foreground">{bank.questionCount} questions</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {banks.map((bank) => (
        <section key={bank.id} aria-labelledby={bank.anchor} className="mt-12">
          <h2 id={bank.anchor} className="scroll-mt-24 text-2xl font-bold text-foreground">
            {bank.title}
          </h2>
          {bank.description ? <p className="mt-2 text-muted-foreground">{bank.description}</p> : null}
          <LessonLinkList lessons={bank.lessons} label="Related lessons" className="mt-3" />

          {/* Level groups are unnamed sections: one region landmark per bank is enough. */}
          {bank.levels.map((group) => (
            <section key={group.level} className="mt-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 id={group.anchor} className="scroll-mt-24 text-lg font-semibold text-foreground">
                  {group.label}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {group.questions.length} {group.questions.length === 1 ? 'question' : 'questions'}
                </span>
              </div>
              <ol role="list" className="mt-3 space-y-4">
                {group.questions.map((question) => (
                  <li key={question.id}>
                    <QuestionCard question={question} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}
