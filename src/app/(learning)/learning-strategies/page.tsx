import React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoPage } from "@/components/templates/InfoPage";
import { LABS_HREF, PLACEMENT_QUIZ_HREF } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Learning strategies",
  description:
    "How to study SystemVerilog and UVM so it sticks: retrieval practice and spaced review with the lesson flashcards, Teach it back and the notebook, lesson quizzes, and deliberate practice in labs and exercises.",
};

const REVIEW_HREF = "/dashboard/review";
const NOTEBOOK_HREF = "/dashboard/notebook";
const EXERCISES_HREF = "/exercises";
const BACKUP_HREF = "/settings#data";

const linkClass =
  "rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function GuideLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

const sectionHeading = "mt-10 mb-3 text-2xl font-semibold";

const LearningStrategiesPage = () => {
  return (
    <InfoPage
      title="Learning strategies"
      description="A short guide to studying SystemVerilog and UVM so it stays with you, and to the study tools on this site."
    >
      <p className="lead">
        Reading a lesson feels productive, but most of what you read once fades within days. Two habits make the
        difference: pulling ideas back out of memory instead of rereading them, and coming back to them over several
        days instead of in one sitting. Every lesson here ends with tools for both.
      </p>

      <section aria-labelledby="why-retrieval-and-spacing">
        <h2 id="why-retrieval-and-spacing" className={sectionHeading}>
          Why retrieval and spacing work
        </h2>
        <p>
          <strong>Retrieval practice</strong> means answering from memory before you look. Each successful recall
          strengthens the memory more than another read-through does, and each failed attempt shows you exactly what
          you have not learned yet. Rereading mostly builds familiarity, which is easy to mistake for understanding.
        </p>
        <p>
          <strong>Spacing</strong> means reviewing the same idea across days, with longer gaps each time you remember
          it. A review just as you are starting to forget takes more effort and lasts longer than a review of something
          you saw five minutes ago. Short, regular sessions beat one long session the night before an interview.
        </p>
      </section>

      <section aria-labelledby="flashcards-and-review">
        <h2 id="flashcards-and-review" className={sectionHeading}>
          Flashcards and the review queue
        </h2>
        <p>
          Lessons with a flashcard deck have a <strong>Reinforce the essentials</strong> section. Read the question,
          answer it in your head or out loud, then flip the card and rate how well you recalled it:
        </p>
        <ul>
          <li>
            <strong>Again</strong>: you did not remember it. The card starts over and comes back the next day.
          </li>
          <li>
            <strong>Hard</strong>, <strong>Good</strong> or <strong>Easy</strong>: you remembered it. The gap before the
            next review grows each time you remember a card, and grows faster the easier it felt.
          </li>
        </ul>
        <p>
          Be honest with the ratings: an optimistic Good only hides a card you need to see again. Cards that are due
          collect in your <GuideLink href={REVIEW_HREF}>review queue</GuideLink>, with a link back to the lesson each
          one came from. A few minutes there every day or two keeps earlier modules fresh while you move on.
        </p>
      </section>

      <section aria-labelledby="teach-it-back-guide">
        <h2 id="teach-it-back-guide" className={sectionHeading}>
          Teach it back
        </h2>
        <p>
          Near the end of every lesson, <strong>Teach it back</strong> asks you to explain the topic in your own words,
          as if to a colleague who is new to it. This is the Feynman technique. The places where your explanation gets vague are
          the places to reread. Check what you wrote against four questions:
        </p>
        <ul>
          <li>Can you define it in one sentence?</li>
          <li>Can you give a concrete SystemVerilog or UVM example?</li>
          <li>Can you say when it goes wrong, or what bug it prevents?</li>
          <li>Did you avoid words you couldn't define yourself?</li>
        </ul>
        <p>
          Choose <strong>Save to notebook</strong> to keep your explanation. Your{" "}
          <GuideLink href={NOTEBOOK_HREF}>notebook</GuideLink> lists every explanation with a link back to its lesson,
          lets you add your own notes, search and edit them, and download everything as Markdown. Rewriting an old
          explanation a week later, without looking at the lesson first, is a good retrieval exercise in itself.
        </p>
      </section>

      <section aria-labelledby="quizzes-and-placement">
        <h2 id="quizzes-and-placement" className={sectionHeading}>
          Lesson quizzes and finding your level
        </h2>
        <p>
          Each lesson's <strong>Practice &amp; Reinforce</strong> section has a short quiz. Take it before you scroll back
          up, and answer from memory: a wrong answer now is cheaper than a wrong assumption in a testbench later. Read
          the explanation for every question you missed, then return to that part of the lesson.
        </p>
        <p>
          If you already know some SystemVerilog or UVM, start with{" "}
          <GuideLink href={PLACEMENT_QUIZ_HREF}>Find your level</GuideLink>. Its ten questions on SystemVerilog, UVM and
          debug habits recommend a starting lesson on the Junior, Practitioner or Expert route, so you spend your time on
          what you don't know yet.
        </p>
      </section>

      <section aria-labelledby="deliberate-practice">
        <h2 id="deliberate-practice" className={sectionHeading}>
          Deliberate practice with labs and exercises
        </h2>
        <p>
          Verification is a skill you build by writing and debugging code, not by reading about it. Deliberate practice
          means working just beyond what you can already do, on one skill at a time, and checking the result straight
          away.
        </p>
        <ul>
          <li>
            The <GuideLink href={LABS_HREF}>labs</GuideLink> give you starter code and step-by-step goals. Work each
            step out yourself before you compare it with the reference solution. The check in the lab is a structural
            check in your browser: it does not compile or simulate, so run the files on your own simulator to see real
            results.
          </li>
          <li>
            The <GuideLink href={EXERCISES_HREF}>exercises</GuideLink> are short drills, such as ordering the UVM phases
            or building an agent, that check your answer immediately and explain what is wrong. Repeat one until you can
            do it without hints.
          </li>
        </ul>
        <p>
          After a lab, write down the bug that cost you the most time and how you found it. That note is worth more
          than the finished code.
        </p>
      </section>

      <section aria-labelledby="study-loop">
        <h2 id="study-loop" className={sectionHeading}>
          A study loop for each lesson
        </h2>
        <ol>
          <li>Read the Quick Take, then try to predict what the rest of the lesson will cover.</li>
          <li>Work through the lesson and type out the code examples instead of only reading them.</li>
          <li>Take the quiz and rate the flashcards from memory.</li>
          <li>Teach it back and save your explanation.</li>
          <li>Do the module's lab or exercise when the lesson points to one.</li>
          <li>Over the following days, clear your review queue before starting something new.</li>
        </ol>
      </section>

      <section aria-labelledby="where-progress-is-kept">
        <h2 id="where-progress-is-kept" className={sectionHeading}>
          Where your progress is kept
        </h2>
        <p>
          You don't need an account. Your flashcard ratings, notebook, quiz results and lab progress are saved in this
          browser only, so they do not follow you to another browser or device. Clearing your browser data deletes
          them: download a backup now and then from <GuideLink href={BACKUP_HREF}>Settings</GuideLink>, where you can
          also restore it in another browser.
        </p>
      </section>
    </InfoPage>
  );
};

export default LearningStrategiesPage;
