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
  testCases: TestCase[];
}
