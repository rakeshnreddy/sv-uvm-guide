import React from "react";
import Link from "next/link";

import ConceptLink from "@/components/knowledge/ConceptLink";
import {
  LazyMdxInteractive,
} from "@/components/mdx/LazyMdxInteractive";
import {
  lazyMdxInteractiveNames,
  type LazyMdxInteractiveName,
} from "@/components/mdx/lazy-mdx-interactives";
import MdxImage from "@/components/mdx/Image";
import { LabLink } from "@/components/mdx/LabLink";
import { InfoPage } from "@/components/templates/InfoPage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/Accordion";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import Panel from "@/components/ui/Panel";
import QuizBase from "@/components/ui/Quiz";

const InteractiveWrapper = ({ children }: { children?: React.ReactNode }) => (
  <div className="my-6 rounded-2xl border border-border/60 bg-muted/20 p-4 md:p-6">
    {children}
  </div>
);

const QuickTake = ({ children }: { children?: React.ReactNode }) => (
  <div className="my-6 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-4 md:p-6">
    <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-300">
      Quick Take
    </p>
    <div className="prose prose-invert max-w-none">{children}</div>
  </div>
);

type QuizQuestionShape = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

const QuizQuestion = (_props: QuizQuestionShape) => null;

const Quiz = ({
  questions,
  children,
}: {
  questions?: QuizQuestionShape[];
  children?: React.ReactNode;
}) => {
  const childQuestions = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => (child as React.ReactElement<QuizQuestionShape>).props)
    .filter(
      (question): question is QuizQuestionShape =>
        Boolean(
          question &&
            typeof question.question === "string" &&
            Array.isArray(question.options) &&
            typeof question.correctAnswer === "string" &&
            typeof question.explanation === "string",
        ),
    );

  const resolvedQuestions = questions?.length ? questions : childQuestions;
  return <QuizBase questions={resolvedQuestions} />;
};

type MdxInteractiveProps = Record<string, unknown>;
type LazyMdxComponent = (props: MdxInteractiveProps) => React.JSX.Element;

const lazyMdxComponents = Object.fromEntries(
  lazyMdxInteractiveNames.map((name) => [
    name,
    (props: MdxInteractiveProps) => (
      <LazyMdxInteractive {...props} name={name} />
    ),
  ]),
) as Record<LazyMdxInteractiveName, LazyMdxComponent>;

export const mdxComponents = {
  InteractiveWrapper,
  QuickTake,
  Quiz,
  QuizQuestion,
  Panel,
  InfoPage,
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CodeBlock,
  Link,
  Alert,
  ConceptLink,
  Image: MdxImage,
  LabLink,
  ...lazyMdxComponents,
};

export function getMdxComponents(_requestedComponents: readonly string[] = []) {
  return mdxComponents;
}
