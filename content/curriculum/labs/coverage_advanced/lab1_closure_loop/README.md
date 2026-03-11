# The Coverage Closure Loop Lab

You have a simple 8-bit ALU testbench. The goal of the test is to ensure every ALU operation (ADD, SUB, MUL, DIV, AND, OR, XOR) is tested. Also, we want to ensure we hit the `MAX_VAL` edge case (inputs being `8'hFF`).

## Scenario
The testbench is currently running 500 random transactions. When you look at the simulator's output (or logically deduce it from the generator), you find that you're stuck at ~85% coverage. Some operations are completely missed, and the `MAX_VAL` corner cases are never hit.

## Your Mission

1. **Analyze the Generator**: Look at `testbench.sv`. The random generator lacks `dist` constraints, and the default uniform distribution isn't hitting everything.
2. **Find the Holes**: Why is the coverage hole happening? (Hint: Does the generic `$urandom()` easily hit `8'hFF` on an 8-bit bus? Hint 2: Is `DIV` even being generated?)
3. **Close the Loop**: Adjust the `randomize() with` constraints inside the `repeat(500)` loop so that the coverage score reported at the end reaches `100.0`.
