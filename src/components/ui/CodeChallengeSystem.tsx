"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  challenges,
  getNextChallenge
} from "@/lib/challenges";
import type { Challenge } from "@/lib/challenges/types";

interface PeerSolution {
  code: string;
  timestamp: number;
  runtime: number;
  comments: string[];
}

const FORBIDDEN = /(process|require|import|export|global|window)/;

function sanitize(code: string) {
  if (FORBIDDEN.test(code)) {
    throw new Error("Forbidden keywords in code");
  }
  return code;
}

function lintCode(code: string) {
  const issues: string[] = [];
  if (/var\s+/.test(code)) issues.push("Avoid using var");
  if (/console\.log/.test(code)) issues.push("Remove console.log statements");
  return issues;
}

function validateStyle(code: string) {
  const issues: string[] = [];
  code.split("\n").forEach((line, i) => {
    if (line.length > 80) issues.push(`Line ${i + 1} exceeds 80 chars`);
    if (/^\t+/.test(line)) issues.push(`Line ${i + 1} uses tabs`);
  });
  return issues;
}

function securityScan(code: string) {
  const issues: string[] = [];
  if (/eval\(/.test(code)) issues.push("Avoid eval()");
  if (/Function\(/.test(code)) issues.push("Avoid Function constructor");
  return issues;
}

function runChallenge(challenge: Challenge, code: string) {
  const fn = new Function(`${code}; return solution;`)();
  let pass = true;
  const runs = 30;
  const start = performance.now();
  for (let i = 0; i < runs; i++) {
    for (const tc of challenge.testCases) {
      const output = fn(...tc.input);
      if (i === 0 && JSON.stringify(output) !== JSON.stringify(tc.expected)) {
        pass = false;
      }
    }
  }
  const duration = (performance.now() - start) / runs;
  return { pass, duration };
}

export const CodeChallengeSystem = () => {
  const [challenge, setChallenge] = useState<Challenge>(challenges[0]);
  const [code, setCode] = useState<string>(challenges[0].starterCode);
  const [result, setResult] = useState<string>("");
  const [peerSolutions, setPeerSolutions] = useState<PeerSolution[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [lastRuntime, setLastRuntime] = useState<number | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    setCode(challenge.starterCode);
    const stored = (
      JSON.parse(localStorage.getItem("challengeSolutions") || "{}")[
        challenge.id
      ] || []
    ) as PeerSolution[];
    setPeerSolutions(stored.sort((a, b) => a.runtime - b.runtime));
  }, [challenge]);

  useEffect(() => {
    const savedPoints = Number(localStorage.getItem("points") || "0");
    const savedAch = JSON.parse(
      localStorage.getItem("achievements") || "[]"
    );
    setPoints(savedPoints);
    setAchievements(savedAch);
  }, []);

  const persistProgress = useCallback((p: number, a: string[]) => {
    localStorage.setItem("points", String(p));
    localStorage.setItem("achievements", JSON.stringify(a));
  }, []);

  const handleEvaluate = () => {
    const lint = lintCode(code);
    const style = validateStyle(code);
    const security = securityScan(code);
    if (security.length) {
      setResult(`Security issues: ${security.join(", ")}`);
      return;
    }

    let evaluation;
    try {
      const safe = sanitize(code);
      evaluation = runChallenge(challenge, safe);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      return;
    }

    setLastRuntime(evaluation.duration);

    let message = "";
    if (lint.length) message += `Lint: ${lint.join("; ")}. `;
    if (style.length) message += `Style: ${style.join("; ")}. `;

    if (evaluation.pass) {
      const newPoints = points + 10;
      const newAch = [...achievements];
      if (!newAch.includes("First Success")) {
        newAch.push("First Success");
      }
      if (evaluation.duration < 50 && !newAch.includes("Fast Solver")) {
        newAch.push("Fast Solver");
      }
      setPoints(newPoints);
      setAchievements(newAch);
      persistProgress(newPoints, newAch);
      setResult(
        `${message}All tests passed in ${evaluation.duration.toFixed(2)}ms`
      );
      setChallenge(getNextChallenge(challenge, true, evaluation.duration));
    } else {
      setResult(
        `${message}Tests failed in ${evaluation.duration.toFixed(2)}ms`
      );
      setChallenge(getNextChallenge(challenge, false, evaluation.duration));
    }
  };

  const handleShare = () => {
    let evaluation;
    try {
      const safe = sanitize(code);
      evaluation = runChallenge(challenge, safe);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      return;
    }
    setLastRuntime(evaluation.duration);

    const store = JSON.parse(localStorage.getItem("challengeSolutions") || "{}");
    const list: PeerSolution[] = store[challenge.id] || [];
    list.push({
      code,
      timestamp: Date.now(),
      runtime: evaluation.duration,
      comments: []
    });
    store[challenge.id] = list;
    localStorage.setItem("challengeSolutions", JSON.stringify(store));
    setPeerSolutions(list.sort((a, b) => a.runtime - b.runtime));
  };

  const addComment = (index: number) => {
    const text = commentInputs[index];
    if (!text) return;
    const updated = [...peerSolutions];
    updated[index].comments = [...(updated[index].comments || []), text];
    setPeerSolutions(updated);
    const store = JSON.parse(localStorage.getItem("challengeSolutions") || "{}");
    store[challenge.id] = updated;
    localStorage.setItem("challengeSolutions", JSON.stringify(store));
    setCommentInputs({ ...commentInputs, [index]: "" });
  };

  return (
    <div className="p-4 border border-dashed border-white/30 rounded-lg my-6 bg-white/5">
      <h2 className="text-2xl font-bold text-primary mb-2">{challenge.title}</h2>
      <p className="text-foreground/80 mb-2">{challenge.description}</p>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full h-40 text-sm font-mono p-2 rounded bg-background border"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleEvaluate}
          className="px-3 py-1 rounded bg-primary text-primary-foreground"
        >
          Run
        </button>
        <button
          onClick={handleShare}
          className="px-3 py-1 rounded bg-secondary text-secondary-foreground"
        >
          Share
        </button>
      </div>
      {result && <p className="mt-2 text-sm">{result}</p>}
      <div className="mt-4">
        <h3 className="font-semibold">Peer Solutions</h3>
        {peerSolutions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No shared solutions yet.
          </p>
        )}
        {peerSolutions.map((s, i) => (
          <div key={i} className="my-2">
            <pre className="bg-background/50 border rounded p-2 overflow-auto text-xs">
              {s.code}
            </pre>
            <p className="text-xs mt-1">Runtime: {s.runtime.toFixed(2)}ms</p>
            {s.comments.length > 0 && (
              <ul className="list-disc list-inside text-xs ml-2">
                {s.comments.map((c, j) => (
                  <li key={j}>{c}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 mt-1">
              <input
                value={commentInputs[i] || ""}
                onChange={(e) =>
                  setCommentInputs({ ...commentInputs, [i]: e.target.value })
                }
                className="border rounded p-1 flex-1 text-xs bg-background"
              />
              <button
                onClick={() => addComment(i)}
                className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-xs"
              >
                Comment
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <h3 className="font-semibold">Points: {points}</h3>
        {achievements.length > 0 && (
          <ul className="list-disc list-inside text-sm">
            {achievements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CodeChallengeSystem;
