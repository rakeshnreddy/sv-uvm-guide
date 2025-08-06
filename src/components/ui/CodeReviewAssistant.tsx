"use client";

import React from "react";
import { CheckCircle, XCircle, Clock } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { useTimedCheck, CheckResult } from "./useTimedCheck";

// ---------------------------------------------------------------------------

// Component
// ---------------------------------------------------------------------------

/**
 * Aggregates automated code quality checks—documentation, tests, architecture,
 * and coding standards—with a minimal peer-review interface.
 * Reviewers provide a commit SHA, free-form comments, and an approval toggle.
 * Each verification uses custom hooks returning a `{status, details}` object.
 *
 * @example
 * <CodeReviewAssistant /> // see `src/app/practice/interactive-demo/page.tsx`
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
  const docs = useTimedCheck(300, "All modules documented");
  const tests = useTimedCheck(400, "Coverage at 85%");
  const architecture = useTimedCheck(500, "Layers follow defined patterns");
  const standards = useTimedCheck(600, "Conforms to style guide");

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
  const [commitError, setCommitError] = React.useState("");
  const [serverError, setServerError] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [comments, setComments] = React.useState<string[]>([]);
  const [approved, setApproved] = React.useState(false);

  const commitIdRegex = /^[0-9a-f]{7,40}$/i;

  const handleCommitChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.trim();
    setCommitId(value);
    if (value && !commitIdRegex.test(value)) {
      setCommitError("Invalid commit SHA");
    } else {
      setCommitError("");
    }
  };

  const addComment = async () => {
    const newComment = comment.trim();
    if (!commitIdRegex.test(commitId)) {
      setCommitError("Invalid commit SHA");
      return;
    }
    if (!newComment) return;
    try {
      setServerError("");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitId, comment: newComment }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setComments((c) => [...c, newComment]);
      setComment("");
    } catch (err) {
      setServerError((err as Error).message);
    }
  };

  const toggleApproval = async () => {
    if (!commitIdRegex.test(commitId)) {
      setCommitError("Invalid commit SHA");
      return;
    }
    const newStatus = !approved;
    try {
      setServerError("");
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitId, approved: newStatus }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setApproved(newStatus);
    } catch (err) {
      setServerError((err as Error).message);
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
          onChange={handleCommitChange}
          className="mb-2"
        />
        {commitError && (
          <p className="text-xs text-red-400 mb-2">{commitError}</p>
        )}
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
        {serverError && (
          <p className="text-xs text-red-400 mb-2">{serverError}</p>
        )}

        {comments.length > 0 && (
          <ul className="list-disc list-inside text-foreground/70 mb-4">
            {comments.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        )}

        <Button onClick={toggleApproval} variant="secondary">
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

