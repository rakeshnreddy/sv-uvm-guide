"use client";

import React from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";

// ---------------------------------------------------------------------------
// Hook and type definitions
// ---------------------------------------------------------------------------

type CheckResult = {
  status: "pending" | "pass" | "fail";
  details?: string;
};

/**
 * Simulates a documentation completeness check for the current commit.
 * @returns {CheckResult} asynchronous status and optional details once the check resolves.
 */
export const useDocumentationCheck = (): CheckResult => {
  const [result, setResult] = React.useState<CheckResult>({ status: "pending" });
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setResult({ status: "pass", details: "All modules documented" });
    }, 300);
    return () => clearTimeout(timer);
  }, []);
  return result;
};

/**
 * Simulates verifying the project's overall test coverage.
 * @returns {CheckResult} asynchronous status and optional coverage information.
 */
export const useTestCoverageCheck = (): CheckResult => {
  const [result, setResult] = React.useState<CheckResult>({ status: "pending" });
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setResult({ status: "pass", details: "Coverage at 85%" });
    }, 400);
    return () => clearTimeout(timer);
  }, []);
  return result;
};

/**
 * Pretends to validate that architectural guidelines are followed in the codebase.
 * @returns {CheckResult} asynchronous status and optional architecture notes.
 */
export const useArchitectureCheck = (): CheckResult => {
  const [result, setResult] = React.useState<CheckResult>({ status: "pending" });
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setResult({ status: "pass", details: "Layers follow defined patterns" });
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  return result;
};

/**
 * Mimics a coding standards linter that ensures style guide adherence.
 * @returns {CheckResult} asynchronous status and optional lint details.
 */
export const useCodingStandardsCheck = (): CheckResult => {
  const [result, setResult] = React.useState<CheckResult>({ status: "pending" });
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setResult({ status: "pass", details: "Conforms to style guide" });
    }, 600);
    return () => clearTimeout(timer);
  }, []);
  return result;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Aggregates automated code quality checks and a minimal peer-review interface.
 * The component has no props and maintains its own state for comments and approval.
 */
export const CodeReviewAssistant = () => {
  // Automated check results
  const [quality, setQuality] = React.useState<CheckResult>({ status: "pending" });
  const [style, setStyle] = React.useState<CheckResult>({ status: "pending" });
  const [vulnerabilities, setVulnerabilities] = React.useState<CheckResult>({
    status: "pending",
  });
  const [performance, setPerformance] = React.useState<CheckResult>({
    status: "pending",
  });

  React.useEffect(() => {
    const timers = [
      setTimeout(
        () => setQuality({ status: "pass", details: "Maintainability index 82" }),
        200,
      ),
      setTimeout(
        () => setStyle({ status: "pass", details: "ESLint checks passed" }),
        300,
      ),
      setTimeout(
        () => setVulnerabilities({ status: "pass", details: "No CVEs detected" }),
        450,
      ),
      setTimeout(
        () => setPerformance({ status: "pass", details: "Render time under 50ms" }),
        550,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Hook-based verifications
  const docs = useDocumentationCheck();
  const tests = useTestCoverageCheck();
  const architecture = useArchitectureCheck();
  const standards = useCodingStandardsCheck();

  const checks = [
    { label: "Code Quality Metrics", result: quality },
    { label: "Style Enforcement", result: style },
    { label: "Vulnerability Scanning", result: vulnerabilities },
    { label: "Performance Checks", result: performance },
    { label: "Documentation Completeness", result: docs },
    { label: "Test Coverage", result: tests },
    { label: "Architectural Patterns", result: architecture },
    { label: "Coding Standards", result: standards },
  ];

  // Peer review workflow state
  const [commitId, setCommitId] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [comments, setComments] = React.useState<string[]>([]);
  const [approved, setApproved] = React.useState(false);

  const addComment = () => {
    if (comment.trim()) {
      setComments((c) => [...c, comment.trim()]);
      setComment("");
    }
  };

  const renderIcon = (status: CheckResult["status"]) => {
    if (status === "pass") return <CheckCircle className="text-green-400" size={16} />;
    if (status === "fail") return <XCircle className="text-red-400" size={16} />;
    return <Clock className="text-yellow-400" size={16} />;
  };

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-4">Code Review Assistant</h2>

      <ul className="space-y-2">
        {checks.map(({ label, result }) => (
          <li key={label} className="flex items-start gap-2 text-foreground/80">
            {renderIcon(result.status)}
            <span className="flex-1">
              <span className="font-medium text-foreground">{label}</span>
              {result.details && (
                <span className="block text-xs text-foreground/60">{result.details}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <h3 className="text-xl font-semibold text-primary mb-2">Peer Review Workflow</h3>
        <Input
          placeholder="Commit ID"
          value={commitId}
          onChange={(e) => setCommitId(e.target.value)}
          className="mb-2"
        />
        {commitId && (
          <p className="text-xs text-foreground/60 mb-2">
            Reviewing commit <span className="font-mono">{commitId}</span>
          </p>
        )}

        <Textarea
          placeholder="Leave a comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mb-2"
        />
        <Button variant="outline" onClick={addComment} className="mb-4">
          Add Comment
        </Button>

        {comments.length > 0 && (
          <ul className="list-disc list-inside text-foreground/70 mb-4">
            {comments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}

        <Button onClick={() => setApproved((a) => !a)} variant="secondary">
          {approved ? "Approved" : "Approve"}
        </Button>
        {approved && (
          <p className="text-green-400 text-sm mt-2">Review approved</p>
        )}
      </div>
    </div>
  );
};

export default CodeReviewAssistant;

