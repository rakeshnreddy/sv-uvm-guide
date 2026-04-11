import { challenges } from '../src/lib/challenges/index.ts';

const fibonacciChallenge = challenges.find((c) => c.id === 'fibonacci');

if (!fibonacciChallenge) {
  console.error('Fibonacci challenge not found!');
  process.exit(1);
}

console.log('Testing Fibonacci Solution with Improved Test Cases...');
let passed = 0;
let total = fibonacciChallenge.testCases.length;

for (const testCase of fibonacciChallenge.testCases) {
  const result = fibonacciChallenge.solution(...testCase.input);
  if (result === testCase.expected) {
    console.log(`✅ Input: ${testCase.input[0]}, Expected: ${testCase.expected}, Got: ${result}`);
    passed++;
  } else {
    console.error(`❌ Input: ${testCase.input[0]}, Expected: ${testCase.expected}, Got: ${result}`);
  }
}

if (passed === total) {
  console.log(`\n🎉 All ${total} test cases passed!`);
} else {
  console.error(`\n😞 ${total - passed} test cases failed.`);
  process.exit(1);
}
