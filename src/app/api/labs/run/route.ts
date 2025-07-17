import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return new Response(`
    Test 'test_initial_state' passed.
    Test 'test_basic_input' passed.
    Test 'test_edge_cases' failed.
  `);
}
