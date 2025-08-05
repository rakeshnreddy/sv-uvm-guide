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
}

const FORBIDDEN = /(process|require|import|export|global|window)/;

function sanitize(code: string) {
  if (FORBIDDEN.test(code)) {
    throw new Error("Forbidden keywords in code");
  }
  return code;
}

function runChallenge(challenge: Challenge, code: string) {
  const fn = new Function(`${code}; return solution;`)();
  const start = performance.now();
  let pass = true;
  for (const tc of challenge.testCases) {
    const output = fn(...tc.input);
    if (JSON.stringify(output) !== JSON.stringify(tc.expected)) {
      pass = false;
      break;
    }
  }
  const duration = performance.now() - start;
  return { pass, duration };
}

export const CodeChallengeSystem = () => {
  const [challenge, setChallenge] = useState<Challenge>(challenges[0]);
  const [code, setCode] = useState<string>(challenges[0].starterCode);
  const [result, setResult] = useState<string>("");
  const [peerSolutions, setPeerSolutions] = useState<PeerSolution[]>([]);
  const [points, setPoints] = useState<number>(0);
  const [achievements, setAchievements] = useState<string[]>([]);

  useEffect(() => {
    setCode(challenge.starterCode);
    const stored = JSON.parse(
      localStorage.getItem("challengeSolutions") || "{}"
    )[challenge.id] || [];
    setPeerSolutions(stored);
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
    let evaluation;
    try {
      const safe = sanitize(code);
      evaluation = runChallenge(challenge, safe);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      return;
    }

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
      setResult(`All tests passed in ${evaluation.duration.toFixed(2)}ms`);
      setChallenge(getNextChallenge(challenge, true));
    } else {
      setResult(`Tests failed in ${evaluation.duration.toFixed(2)}ms`);
      setChallenge(getNextChallenge(challenge, false));
    }
  };

  const handleShare = () => {
    const store = JSON.parse(localStorage.getItem("challengeSolutions") || "{}");
    const list: PeerSolution[] = store[challenge.id] || [];
    list.push({ code, timestamp: Date.now() });
    store[challenge.id] = list;
    localStorage.setItem("challengeSolutions", JSON.stringify(store));
    setPeerSolutions(list);
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
          <pre
            key={i}
            className="bg-background/50 border rounded p-2 my-2 overflow-auto text-xs"
          >
            {s.code}
          </pre>
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
