---
sidebar_label: 'A3 - Config and Factory Mastery'
sidebar_position: 3
---

# A3 – UVM Configurations and Factory Mastery

You've learned the basics of the UVM factory and configuration database (`uvm_config_db`). Now it's time to master them. These two components are the heart of UVM's power, enabling the creation of highly reusable, modular, and customizable testbench environments.

## 1. Advanced Factory Usage: Polymorphism in Action

The factory's primary purpose is to enable **polymorphism**—the ability to substitute one type of component or object for another at runtime without changing the testbench's source code. This is the key to creating flexible and reusable verification IP.

### Example: The Error-Injecting Driver

Imagine you have a standard, well-behaved `alu_driver`. Now, you want to create a special test that injects errors. Instead of creating a whole new environment, you can create a specialized `error_injecting_driver` and use the factory to swap it in.

1.  **Base Driver (`alu_driver.sv`)**: This is the standard driver.

    ```systemverilog
    class alu_driver extends uvm_driver #(alu_transaction);
      `uvm_component_utils(alu_driver)
      // ... standard driver logic ...
    endclass
    ```

2.  **Extended Driver (`error_injecting_driver.sv`)**: This driver extends the base driver and overrides the `run_phase` to sometimes corrupt the data.

    ```systemverilog
    class error_injecting_driver extends alu_driver;
      `uvm_component_utils(error_injecting_driver)

      virtual task run_phase(uvm_phase phase);
        // ... gets item from sequencer ...
        if ($urandom_range(0, 9) == 0) begin // 10% chance to inject error
          `uvm_info("INJECT_ERROR", "Corrupting opcode!", UVM_MEDIUM)
          req.op = alu_op_e'($urandom); // Corrupt the opcode
        end
        // ... drives the (possibly corrupted) transaction ...
      endtask
    endclass
    ```

3.  **The Tests**: The environment code is identical for both tests. The only difference is the factory override in the `error_test`.

    -   **`base_test.sv`**: Uses the default driver. No overrides needed.

        ```systemverilog
        class base_test extends uvm_test;
          // ... build_phase instantiates the environment ...
        endclass
        ```

    -   **`error_test.sv`**: Uses the factory to replace `alu_driver` with `error_injecting_driver`.

        ```systemverilog
        class error_test extends base_test;
          `uvm_component_utils(error_test)

          function void build_phase(uvm_phase phase);
            super.build_phase(phase);
            // Override the driver for the agent inside our environment
            alu_driver::type_id::set_inst_override(error_injecting_driver::get_type(),
                                                   "m_env.m_agent.*");
          endfunction
        endclass
        ```

When `error_test` runs, any time the environment tries to create an `alu_driver` (i.e., `alu_driver::type_id::create()`), the factory will return an instance of `error_injecting_driver` instead.

### Factory Debugging

How do you know which overrides are active? The factory provides a built-in debugging tool.

```systemverilog
// In your test's end_of_elaboration_phase
function void end_of_elaboration_phase(uvm_phase phase);
  super.end_of_elaboration_phase(phase);
  factory.print(); // Print all factory overrides
endfunction
```

This will print a table showing all the instance and type overrides currently registered with the factory, which is invaluable for debugging complex test scenarios.

### The `uvm_object_wrapper`

You'll notice that the factory override methods (`set_inst_override`, `set_type_override`) don't take strings as arguments for the types; they take `uvm_object_wrapper`s. The `::get_type()` static method returns this wrapper.

The `uvm_component_utils` and `uvm_object_utils` macros create these static `get_type()` functions for you. The wrapper is a lightweight object that represents the class type, allowing the factory to work with types as objects.

## 2. Advanced `uvm_config_db` Usage

While the factory changes the *type* of a component, the `uvm_config_db` changes its *behavior and structure*.

### Configuration Objects

Passing individual settings (like `int`, `string`, `virtual interface`) is fine for simple cases. However, for a complex component like an agent, it's much cleaner and more scalable to group all its settings into a single **configuration object**.

1.  **Create a Config Class (`alu_agent_config.sv`)**: This class extends `uvm_object` (not `uvm_component`) and holds all the agent's configuration knobs.

    ```systemverilog
    class alu_agent_config extends uvm_object;
      `uvm_object_utils(alu_agent_config)

      // Is the agent active (driver+sequencer) or passive (monitor only)?
      uvm_active_passive_enum is_active = UVM_ACTIVE;

      // Should the coverage collector be created?
      bit has_coverage = 1;

      // Handle to the virtual interface
      virtual alu_if vif;

      function new(string name = "alu_agent_config");
        super.new(name);
      endfunction
    endclass
    ```

2.  **Set the Object in the Test**: The test is responsible for creating and setting the configuration object.

    ```systemverilog
    // In the test's build_phase
    m_agent_config = alu_agent_config::type_id::create("m_agent_config");
    m_agent_config.is_active = UVM_PASSIVE; // Configure for this specific test
    m_agent_config.has_coverage = 0;
    uvm_config_db#(alu_agent_config)::set(this, "m_env.m_agent", "config", m_agent_config);
    ```

3.  **Get the Object in the Component**: The agent retrieves the single configuration object and uses it to build itself.

    ```systemverilog
    // In the agent's build_phase
    alu_agent_config m_config;

    virtual function void build_phase(uvm_phase phase);
      super.build_phase(phase);
      if (!uvm_config_db#(alu_agent_config)::get(this, "", "config", m_config))
        `uvm_fatal("NO_CONFIG", "Agent config not found!")

      // Now use the config object to conditionally build components
      if (m_config.is_active == UVM_ACTIVE) begin
        m_driver = alu_driver::type_id::create("m_driver", this);
        m_sequencer = uvm_sequencer...::type_id::create("m_sequencer", this);
      end
      m_monitor = alu_monitor::type_id::create("m_monitor", this);

      if (m_config.has_coverage) begin
        // create coverage component...
      end
    endfunction
    ```

This pattern makes the agent highly reusable. The same agent component can be configured to be active, passive, or have different features enabled or disabled, just by changing the configuration object passed from the test.

### The Resource Database (`uvm_resource_db`)

The `uvm_config_db` is actually a convenience wrapper around a more fundamental class: `uvm_resource_db`. The resource database is a more general-purpose database for sharing information across the testbench. Resources have properties like precedence, which can be used to resolve conflicts if multiple components try to set the same resource.

For 99% of verification work, `uvm_config_db` is the right tool. You only need to drop down to `uvm_resource_db` for very advanced use cases, such as building custom configuration mechanisms.

### Scoping and Wildcards

The `uvm_config_db::set` call takes an instance path as its second argument. This path can include wildcards (`*` or `?`) to set a configuration for multiple components at once.

```systemverilog
// Set the "recording_detail" for ALL components in the testbench
uvm_config_db#(int)::set(this, "*", "recording_detail", UVM_FULL);

// Set the virtual interface for the driver and monitor in m_agent_a
uvm_config_db#(virtual alu_if)::set(this, "m_env.m_agent_a.*", "vif", m_vif);
```

## 3. Practical Example: Active/Passive Agent

This example demonstrates the power of a configuration object to change an agent from `UVM_ACTIVE` to `UVM_PASSIVE`.

-   `base_test`: Configures the agent to be `UVM_ACTIVE`. The agent will build its driver and sequencer.
-   `passive_test`: Configures the agent to be `UVM_PASSIVE`. The agent will only build its monitor.

The environment code is identical in both cases. The testbench structure adapts dynamically based on the configuration it receives.

**(The full code for this example is in `tests/A3_advanced_config_example/`)**

## 4. Summary: Factory vs. Config DB

Use...

-   **The Factory (`set_*_override`)** when you want to **change the type** of a component or object. You are swapping one class for another compatible class (one that shares the same base class).
    -   *Example: Replacing a standard driver with an error-injecting driver.*

-   **The Configuration Database (`uvm_config_db`)** when you want to **change the behavior, structure, or settings** of a component. You are parameterizing the component.
    -   *Example: Setting an agent to be active or passive, enabling/disabling coverage, passing a virtual interface handle.*
