export type Difficulty = "easy" | "medium" | "hard";

export interface TestCase {
  input: any[];
  expected: any;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  starterCode: string;
  /**
   * Reference implementation used for automated tests.
   * Receives the challenge inputs and returns the result.
   */
  solution: (...args: any[]) => any;
  testCases: TestCase[];
}
