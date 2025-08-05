import { Challenge } from "./types";

export const challenges: Challenge[] = [
  {
    id: "add-two",
    title: "Add Two Numbers",
    description: "Return the sum of two numbers.",
    difficulty: "easy",
    starterCode: `function solution(a: number, b: number) {
  // TODO: return the sum of a and b
}`,
    testCases: [
      { input: [1, 2], expected: 3 },
      { input: [5, 7], expected: 12 }
    ]
  },
  {
    id: "factorial",
    title: "Factorial",
    description: "Return the factorial of n.",
    difficulty: "medium",
    starterCode: `function solution(n: number) {
  // TODO: return n!
}`,
    testCases: [
      { input: [3], expected: 6 },
      { input: [5], expected: 120 }
    ]
  },
  {
    id: "fibonacci",
    title: "Fibonacci",
    description: "Return the nth Fibonacci number.",
    difficulty: "hard",
    starterCode: `function solution(n: number) {
  // TODO: return the nth fibonacci number
}`,
    testCases: [
      { input: [5], expected: 5 },
      { input: [10], expected: 55 }
    ]
  }
];

export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id);
}

export function getNextChallenge(current: Challenge, success: boolean): Challenge {
  const index = challenges.findIndex((c) => c.id === current.id);
  if (success) {
    return challenges[Math.min(index + 1, challenges.length - 1)];
  }
  return challenges[Math.max(index - 1, 0)];
}
