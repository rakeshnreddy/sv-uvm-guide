import TopicPage from '../components/TopicPage';
import CodeBlock from '../components/CodeBlock';

export default function RandomizationAndConstraintsTopicPage() {
  const pageContent = {
    title: "SystemVerilog Randomization & Constraints",
    elevatorPitch: {
      definition: "Randomization in SystemVerilog is the process of generating random values for variables, typically within class objects, to create diverse stimulus for simulation. Constraints are rules defined within classes that guide and restrict this randomization process, ensuring that the generated values are valid, interesting, and cover desired scenarios.",
      analogy: "Think of randomization like a 'deli sandwich maker' who can pick ingredients randomly. Without guidance, you might get a weird sandwich (invalid stimulus). **Constraints** are like your specific order to the sandwich maker: 'Use rye or wheat bread (constraint on bread type), include turkey or ham (constraint on meat), but NO pickles (constraint excluding an option), and make sure there's more meat than cheese (relational constraint).' The sandwich is still somewhat random and surprising, but it meets your defined criteria (valid and interesting stimulus).",
      why: "Randomization and constraints exist to automate the generation of a wide range of valid and interesting test scenarios, far exceeding what can be manually created with directed tests. This is crucial for finding corner-case bugs in complex designs. Constraints allow verification engineers to declaratively specify the 'legal space' for stimulus, letting the simulator's constraint solver explore that space efficiently. This leads to more thorough verification and higher bug detection rates with less manual effort."
    },
    practicalExplanation: {
      coreMechanics: `
-   **Random Variables (\`rand\` and \`randc\`):**
    -   Class properties can be declared as randomizable using the \`rand\` or \`randc\` keywords.
    -   \`rand\`: Standard random variable. Values are chosen with uniform distribution unless constrained. Values can repeat.
    -   \`randc\`: Cyclic random variable. Permutates through all possible values in its range before repeating any value. Useful for ensuring all values of a small set are eventually generated (e.g., opcodes, error flags). Once all values are exhausted, it can either stop or restart the cycle (tool-dependent or controlled by options).

-   **\`randomize()\` Method:**
    -   This is a built-in virtual method for classes. Calling \`object.randomize()\` triggers the constraint solver to generate new random values for all \`rand\` and \`randc\` members of the object, subject to active constraints.
    -   Returns 1 if successful, 0 if the constraints are unsatisfiable.

-   **Constraint Blocks (\`constraint <name> { ... }\`):**
    -   Defined within a class to specify rules for random variables.
    -   Constraints are declarative; their order of definition generally doesn't matter. The solver considers all active constraints simultaneously.
    -   **Expressions:** Can use standard SystemVerilog operators (\`==\`, \`!=\`, \`<\`, \`>\`, \`+ \`, \`-\`, logical \`&&\`, \`||\`, \`!\`, bitwise, etc.).
    -   **Set Membership (\`inside\`):** \`variable inside {value_set};\` (e.g., \`addr inside {[0:255], 1024};\`).
    -   **Distribution (\`dist\`):** \`variable dist {value := weight, range := weight};\` (e.g., \`op_type dist {READ := 40, WRITE := 60};\`). Weights determine probability.
    -   **Implication (\`->\`):** \`condition -> constraint_expression;\` (If condition is true, then constraint_expression must hold).
    -   **If-Else (\`if ... else ...\`):** \`if (condition) constraint1; else constraint2;\`
    -   **Iterative Constraints (\`foreach\`):** Apply constraints to elements of an array. \`foreach (my_array[i]) { my_array[i] < 100; }\`.
    -   **Soft Constraints (\`soft\`):** \`soft variable == value;\`. These are constraints the solver will try to satisfy but can ignore if they conflict with hard (non-soft) constraints.
    -   **Uniqueness (\`unique\`):** \`unique {var1, var2, array1};\` Ensures that the listed variables/arrays have unique values/elements relative to each other.

-   **Controlling Constraints:**
    -   **\`constraint_mode()\`:** Turn constraints on or off procedurally. \`my_object.my_constraint.constraint_mode(0);\` (off) or \`(1)\` (on).
    -   **\`rand_mode()\`:** Turn randomization of specific variables on or off. \`my_object.my_variable.rand_mode(0);\` (off).

-   **In-line Constraints (\`with\` clause):**
    -   Temporarily add constraints during a \`randomize()\` call.
    -   \`assert(object.randomize() with { variable > 10; });\`
    -   These do not override class constraints but are solved along with them.

-   **Static Constraints vs. Procedural Constraints:**
    -   Constraints within classes are generally static (defined at compile time).
    -   Procedural code can influence randomization through \`constraint_mode\`, \`rand_mode\`, and \`with\` clauses.

-   **Solving Order & Precedence:**
    -   The constraint solver attempts to satisfy all hard constraints.
    -   If conflicts arise, \`randomize()\` fails.
    -   `solve ... before`: \`solve varA before varB;\` Influences the order in which the solver tries to pick values, which can be important for complex dependent constraints or for achieving desired distributions.

-   **`std::randomize()`:** A standalone function (not a class method) to randomize variables outside of a class context, but it cannot use class-based constraint blocks directly. Useful for randomizing local variables in a module or program block.
    -   \`std::randomize(var1, var2) with { var1 + var2 < 10; };\`
`,
      codeExamples: [
        {
          description: "Basic randomization with simple constraints:",
          code:
`class packet;
  rand bit [7:0] data;
  rand bit [3:0] length; // 0 to 15
  rand boolean is_error;

  constraint c_len_valid { length > 0; length < 10; } // Length between 1 and 9
  constraint c_no_error_on_short_pkt {
    // If length is small, it must not be an error packet
    (length < 3) -> (is_error == 0);
  }

  function void print();
    $display("Packet: Data=0x%2h, Length=%0d, Error=%b", data, length, is_error);
  endfunction
endclass

module top_rand_basic;
  initial begin
    packet pkt = new();
    repeat(5) begin
      if (!pkt.randomize()) begin
        $error("Randomization failed!");
      end
      pkt.print();
    end
  end
endmodule`
        },
        {
          description: "Distribution, `inside`, and `randc` example:",
          code:
`class instruction;
  typedef enum {ADD, SUB, MUL, DIV, NOP} opcode_e;
  rand opcode_e op;
  rand bit [2:0] src1_reg;
  rand bit [2:0] src2_reg;
  randc bit [1:0] priority; // Will cycle through 0,1,2,3 before repeating

  constraint c_op_dist {
    op dist { ADD := 30, SUB := 30, MUL := 20, DIV := 10, NOP := 10 };
  }
  constraint c_valid_regs {
    src1_reg inside {[0:5]}; // Registers 0-5 are valid
    src2_reg inside {[0:5]};
  }
  constraint c_no_same_src_for_critical_ops {
    // For MUL or DIV, source registers must be different
    (op inside {MUL, DIV}) -> (src1_reg != src2_reg);
  }

  function void print();
    $display("Instr: Op=%s, Src1=R%0d, Src2=R%0d, Prio=%0d", op.name(), src1_reg, src2_reg, priority);
  endfunction
endclass

module top_rand_dist;
  initial begin
    instruction instr = new();
    repeat(8) begin // Repeat more than priority range to see cycling
      void'(instr.randomize());
      instr.print();
    end
  end
endmodule`
        },
        {
          description: "In-line constraints with `randomize() with { ... }` and `constraint_mode()`:",
          code:
`class config_obj;
  rand int delay_val;
  rand boolean enable_feature_x;

  constraint c_delay_range { delay_val inside {[1:100]}; }
  constraint c_feature_x_default_off { soft enable_feature_x == 0; } // Soft constraint

  function new(); endfunction
  function void print(); $display("Config: Delay=%0d, FeatureX=%b", delay_val, enable_feature_x); endfunction
endclass

module top_rand_inline;
  initial begin
    config_obj cfg = new();

    $display("--- Default Randomization ---");
    void'(cfg.randomize()); cfg.print();

    $display("--- Randomize with FeatureX ON (inline) ---");
    void'(cfg.randomize() with { enable_feature_x == 1; });
    cfg.print(); // delay_val still respects c_delay_range

    $display("--- Turn off c_delay_range constraint ---");
    cfg.c_delay_range.constraint_mode(0); // Turn off the delay range constraint
    void'(cfg.randomize() with { delay_val > 200; }); // Now delay can be > 100
    cfg.print();
    cfg.c_delay_range.constraint_mode(1); // Turn it back on for good measure

    $display("--- Randomize with conflicting inline (should fail if hard) ---");
    // This would fail if c_delay_range was hard and active:
    // if (!cfg.randomize() with { delay_val > 100; }) $error("Expected fail");
  end
endmodule`
        },
        {
          description: "Iterative constraints with `foreach` for an array:",
          code:
`class data_array_container;
  rand byte unsigned data[10]; // Array of 10 random bytes

  // Constraint: All elements must be less than 50
  constraint c_elements_lt_50 {
    foreach (data[i]) {
      data[i] < 50;
    }
  }
  // Constraint: Sum of first 3 elements must be > 10
  constraint c_sum_first_3 {
    data[0] + data[1] + data[2] > 10;
  }
  // Constraint: Array elements must be strictly increasing
  constraint c_strictly_increasing {
    foreach (data[i]) {
      if (i > 0) data[i] > data[i-1];
    }
  }
  function void print; $display("Data Array: %p", data); endfunction
endclass

module top_foreach_rand;
  initial begin
    data_array_container dac = new();
    repeat(3) begin
      if(!dac.randomize()) $error("DAC randomize failed");
      dac.print();
    end
  end
endmodule`
        }
      ],
      visualizations: [
        { description: "Diagram showing a valid solution space defined by multiple constraints.", altText: "Constraint Solution Space" },
        { description: "Flowchart of the `randomize()` method call showing constraint solving and value generation.", altText: "Randomize Method Flowchart" }
      ]
    },
    deepDive: {
      advancedScenarios: `
      - **Constraint Layering & Overrides:** In UVM, sequences often extend base sequences and add or modify constraints. Understanding how constraints from base and derived classes interact is key.
      - **`pre_randomize()` and `post_randomize()` Methods:** These are built-in class methods automatically called before and after \`randomize()\` respectively. \`pre_randomize()\` can be used to set up conditions or turn constraints on/off before solving. \`post_randomize()\` can be used to calculate dependent fields based on randomized values or check consistency.
      - **Random Stability:** By default, random variables are "unstable" - they get new values on every \`randomize()\` call. If a variable's \`rand_mode\` is turned off, it becomes stable (keeps its value) unless explicitly assigned.
      - **Constraint Solver Performance:** Very complex constraints or large numbers of constraints can significantly slow down simulation. Simplifying constraints, using \`solve...before\`, or breaking down complex randomization problems can help.
      - **Debugging Constraint Failures:** When \`randomize()\` returns 0, it means constraints are contradictory. Simulators often provide tools or logs to help identify conflicting constraints. Simplifying the problem by turning constraints off one by one is a common debug technique.
      - **Seeding Randomization:** Controlling the random seed allows for reproducible random simulations, vital for debugging.
      - **Biased Randomization vs. Pure Random:** While constraints define legal values, sometimes you need to explicitly bias towards corner cases that pure randomization might hit infrequently. This is done with \`dist\` or by layering constrained sequences.
      - **Dynamic Constraints:** Using class variables (non-rand) within constraint expressions allows constraints to change based on the object's state or external settings.
      Common Pitfalls:
      - Over-constraining the problem, leading to \`randomize()\` failures or very limited solution space.
      - Writing constraints that unintentionally conflict.
      - Performance issues due to inefficiently written constraints (e.g., deeply nested loops or complex implications).
      - Misunderstanding \`randc\` behavior, especially when its range is large or when used with other constraints.
      - Issues with \`solve...before\` where the order doesn't achieve the desired effect or introduces new conflicts.`,
      experienceView: `A senior engineer views constrained randomization as a powerful engine for stimulus generation.
      - **Verification Plan Driven:** Constraints are written to target specific items in the verification plan, ensuring that generated stimulus exercises interesting behaviors and corner cases.
      - **Orthogonality:** They try to define constraints as orthogonally as possible, so changing one constraint doesn't unexpectedly break others.
      - **Layering for Control:** Base classes/sequences define broad constraints, while derived classes/sequences add more specific or overriding constraints for particular test scenarios.
      - **Readability & Maintainability:** Well-named constraints and clear expressions are crucial, as constraint sets can become very complex.
      - **Solver Awareness:** Understanding how constraint solvers generally work helps in writing efficient and effective constraints. They know when to use \`dist\`, \`solve...before\`, or \`soft\` constraints strategically.
      - **Coverage Feedback:** Functional coverage results are used to assess the effectiveness of the randomization and constraints. If coverage holes exist, constraints might be added or modified to target those scenarios.
      In code reviews: "Is this constraint necessary, or is it over-constraining?", "Does this constraint accurately reflect the desired scenario from the test plan?", "Are there any potential conflicts between this constraint and others?", "Could this constraint be written more efficiently or clearly?", "How does this constraint interact with inherited constraints (if any)?". They focus on the correctness, completeness, and efficiency of the constraint set.`,
      retentionTip: "Randomization & Constraints: You're the 'Director of Controlled Chaos.' **`rand` / `randc`** are your 'Actors' (variables). **`randomize()`** is yelling 'Action!'. **Constraints** are your 'Script' – they tell the actors what they *can* and *cannot* do, what they *should* do, and what they *should prefer* to do, to create an interesting and valid scene (stimulus)."
    }
  };

  return <TopicPage {...pageContent} />;
}
