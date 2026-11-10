import { CircleCheck, CircleX } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

/*
 * The result of "Check solution" (or of marking a step complete), shown under
 * the editor. A pass or a failure is a status box with an icon and a label, so
 * it never relies on colour alone; a neutral message ("Checking workspace…")
 * is plain text. The outer element is a polite live region that is always
 * mounted, so assistive technology announces each new result.
 */

export type LabResultTone = "success" | "danger";

export interface InlineCodePart {
  text: string;
  code: boolean;
}

/** Splits a message on backticks: `like this` becomes a code part. An unpaired backtick stays as text. */
export function splitInlineCode(message: string): InlineCodePart[] {
  const parts: InlineCodePart[] = [];
  const pattern = /`([^`\n]+)`/g;
  let last = 0;
  for (const match of message.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: message.slice(last, index), code: false });
    parts.push({ text: match[1], code: true });
    last = index + match[0].length;
  }
  if (last < message.length) parts.push({ text: message.slice(last), code: false });
  return parts;
}

/** A message with its backticked spans rendered as inline code. */
export function InlineCodeText({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, index) =>
        part.code ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground [font-variant-ligatures:none]"
          >
            {part.text}
          </code>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        ),
      )}
    </>
  );
}

const TONE_STYLES: Record<LabResultTone, { box: string; label: string; Icon: typeof CircleCheck }> = {
  success: { box: "border-success/50 bg-success-subtle", label: "text-success", Icon: CircleCheck },
  danger: { box: "border-danger/50 bg-danger-subtle", label: "text-danger", Icon: CircleX },
};

/** The default label for a tone, used when the caller gives none. */
export function defaultResultLabel(tone: LabResultTone): string {
  return tone === "success" ? "Check passed" : "Check failed";
}

interface LabCheckResultProps {
  /** Pass or failure; null for a neutral progress message. */
  tone: LabResultTone | null;
  /** The label beside the icon, for example "Check failed". Defaults by tone. */
  label?: string | null;
  /** The message; backticked spans render as inline code. Empty renders nothing inside the live region. */
  message: string;
  /** Extra detail inside the box, such as the list of check diagnostics. */
  children?: React.ReactNode;
  className?: string;
}

export function LabCheckResult({ tone, label, message, children, className }: LabCheckResultProps) {
  const hasContent = message.length > 0 || Boolean(children);
  return (
    <div data-testid="lab-check-result" role="status" aria-live="polite" className={className}>
      {!hasContent ? null : tone ? (
        <LabResultBox tone={tone} label={label ?? defaultResultLabel(tone)} message={message}>
          {children}
        </LabResultBox>
      ) : (
        <>
          {message ? (
            <p data-testid="lab-check-message" className="whitespace-pre-line text-ui text-muted-foreground [overflow-wrap:anywhere]">
              <InlineCodeText text={message} />
            </p>
          ) : null}
          {children}
        </>
      )}
    </div>
  );
}

function LabResultBox({
  tone,
  label,
  message,
  children,
}: {
  tone: LabResultTone;
  label: string;
  message: string;
  children?: React.ReactNode;
}) {
  const styles = TONE_STYLES[tone];
  const { Icon } = styles;
  return (
    <div data-testid="lab-check-box" data-tone={tone} className={cn("flex gap-3 rounded-lg border p-3", styles.box)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", styles.label)} />
      <div className="min-w-0 flex-1">
        <p data-testid="lab-check-label" className={cn("text-ui font-semibold", styles.label)}>
          {label}
        </p>
        {message ? (
          <p data-testid="lab-check-message" className="mt-1 whitespace-pre-line text-ui text-foreground [overflow-wrap:anywhere]">
            <InlineCodeText text={message} />
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
