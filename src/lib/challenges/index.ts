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
    solution: (a: number, b: number): number => a + b,
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
    solution: (n: number): number => {
      if (!Number.isInteger(n) || n < 0) {
        throw new Error("n must be a non-negative integer");
      }
      let result = 1;
      for (let i = 2; i <= n; i++) {
        result *= i;
      }
      return result;
    },
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
    solution: (n: number): number => {
      if (!Number.isInteger(n) || n < 0) {
        throw new Error("n must be a non-negative integer");
      }
      if (n <= 1) return n;
      let prev = 0;
      let curr = 1;
      for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
      }
      return curr;
    },
    testCases: [
      { input: [5], expected: 5 },
      { input: [10], expected: 55 }
    ]
  }
];

export function getChallengeById(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id);
}

// Adapt challenge difficulty based on success and performance
export function getNextChallenge(
  current: Challenge,
  success: boolean,
  duration: number
): Challenge {
  const index = challenges.findIndex((c) => c.id === current.id);

  // If the user failed or the solution was very slow, step down a level
  if (!success || duration > 100) {
    return challenges[Math.max(index - 1, 0)];
  }

  // If the user solved the challenge quickly, advance to a harder one
  if (duration < 50) {
    return challenges[Math.min(index + 1, challenges.length - 1)];
  }

  // Otherwise, keep the current difficulty
  return challenges[index];
}
