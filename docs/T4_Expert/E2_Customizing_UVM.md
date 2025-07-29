---
sidebar_position: 2
---

# E2: Customizing UVM

The UVM provides a powerful, standardized framework, but one size does not fit all. For complex verification challenges, you often need to extend UVM's core components to fit your project's specific needs. This module covers three advanced customization techniques: creating custom TLM ports, building custom report handlers, and using UVM callbacks for non-intrusive modifications.

## 1. Custom Transaction-Level Modeling (TLM)

### Recap: Standard TLM-1

You are already familiar with the standard TLM-1 ports, especially `uvm_analysis_port`. It's a "broadcast" port: one component broadcasts a transaction, and any number of listeners (subscribers) can receive it via their `uvm_analysis_imp`. This is a non-blocking, "fire-and-forget" communication style, perfect for monitors and scoreboards.

### Beyond Analysis: The Need for Other Protocols

What if communication needs to be more complex?
-   What if a component needs to **request** data from another and **wait** for the response?
-   What if a component needs to provide a transaction but can only do so when the receiver is ready?

This is where other TLM communication patterns come in. UVM provides several built-in port types to handle these scenarios.

### Example: `uvm_blocking_get_port`

The "blocking get" is a pull-style communication. A consumer component actively requests data from a provider, and the `get()` task blocks until the provider furnishes the transaction.

-   **Consumer:** Has a `uvm_blocking_get_port`. It calls `port.get(t)` to request a transaction `t`.
-   **Provider:** Has a `uvm_blocking_get_imp`. It implements the `task get(output T t)`, which contains the logic to create and return the requested transaction.

Let's see it in code:

```systemverilog
// Provider Component (e.g., a data source)
class my_data_provider extends uvm_component;
  `uvm_component_utils(my_data_provider)

  // The implementation port
  uvm_blocking_get_imp #(my_transaction, my_data_provider) get_imp;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    get_imp = new("get_imp", this);
  endfunction

  // The required implementation of the 'get' task
  virtual task get(output my_transaction t);
    // This logic would create or fetch a transaction
    t = new("t");
    t.data = 32'hDEADBEEF;
  endtask
endclass

// Consumer Component (e.g., a driver)
class my_consumer extends uvm_component;
  `uvm_component_utils(my_consumer)

  // The port used to request data
  uvm_blocking_get_port #(my_transaction) get_port;

  function void build_phase(uvm_phase phase);
    super.build_phase(phase);
    get_port = new("get_port", this);
  endfunction

  task run_phase(uvm_phase phase);
    my_transaction req;
    // This call will block until the provider returns a transaction
    get_port.get(req);
    `uvm_info(get_type_name(), $sformatf("Got transaction with data: %h", req.data), UVM_MEDIUM)
  endtask
endclass
```

In the environment, you would connect them: `consumer.get_port.connect(provider.get_imp);`.

### Truly Custom TLM Ports

While UVM provides a rich set of predefined TLM ports (`put`, `get`, `peek`, `transport`), you can define your own for highly specialized communication protocols. This is an advanced topic that involves:
1.  Defining a custom transaction base class (extending `uvm_object`).
2.  Defining a custom TLM interface class (extending `uvm_tlm_if_base`).
3.  Using macros `uvm_tlm_req_rsp_channel` to generate the necessary port/export/imp classes.

This is rarely needed but offers ultimate flexibility for modeling non-standard on-chip communication buses or other unique hardware interfaces at a high level of abstraction.

## 2. Custom Report Handlers

UVM's reporting mechanism is functional but generic. For large, automated regression systems, you often need more control over the log file format. You might want to:
-   Format messages as XML, JSON, or some other machine-readable format.
-   Automatically elevate certain errors to UVM_FATAL.
-   Suppress known, benign errors from a particular component to clean up the logs.

This is accomplished with a **report catcher**.

### `uvm_report_server` vs. `uvm_report_catcher`

-   **`uvm_report_server`**: This is the global, singleton object that processes all reports. You can configure it, but you don't extend it.
-   **`uvm_report_catcher`**: This is a callback-based mechanism. You create a class that extends `uvm_report_catcher` and register it with the UVM kernel. Your catcher's `catch()` method is then called *before* the report server processes a message, giving you a chance to intercept, modify, or suppress it.

### Implementing a Custom Report Catcher

Let's create a catcher that demotes a specific error message to a warning.

**Step 1: Define the Catcher Class**
The core of the catcher is the `catch()` method. This method returns an action:
-   `THROW`: Pass the report on to the next catcher and the report server (default).
-   `CAUGHT`: Suppress the report. The report server will never see it.

```systemverilog
// In tests/E2_customization_examples.sv

// 1. Define the catcher by extending uvm_report_catcher
class demote_error_catcher extends uvm_report_catcher;
  function new(string name="demote_error_catcher");
    super.new(name);
  endfunction

  // 2. Implement the catch() method - this is the core logic
  function action_e catch();
    // Check if the report matches our specific criteria
    if (get_severity() == UVM_ERROR && get_id() == "MY_COMP_ERR") begin
      `uvm_info(get_name(), "Caught and demoted specific error.", UVM_LOW)
      // Change the severity on the fly
      set_severity(UVM_WARNING);
    end
    // Pass the (potentially modified) report on
    return THROW;
  endfunction
endclass
```

**Step 2: Register and Enable the Catcher**
In your test or environment, you need to create an instance of your catcher and add it to the report handling queue.

```systemverilog
// In your test's build_phase or start_of_simulation_phase
function void my_test::start_of_simulation_phase(uvm_phase phase);
  demote_error_catcher catcher = new("catcher");

  // To catch reports from a specific component and its children:
  // uvm_report_cb::add(p_sequencer.m_driver, catcher);

  // Or to catch reports from all components (more common):
  uvm_report_cb::add(null, catcher);
endfunction
```

Now, any time a component issues a `uvm_error` with the ID "MY_COMP_ERR", it will appear in the log as a `UVM_WARNING` instead, and the error count will not be incremented.

## 3. UVM Callbacks: Non-Intrusive Modification

Factory overrides are powerful, but they are a heavyweight solution. If you want to replace a driver, you override it. But what if you just want to inject a small piece of functionality at a specific point in a driver's `run_phase`? For example:
-   Injecting an error just before a transaction is driven.
-   Collecting functional coverage after a transaction is received.
-   Adding a small delay to model a pipeline bubble.

Modifying the original component class is bad for reusability. The elegant solution is **UVM callbacks**.

### The UVM Callback Pattern

The pattern involves four key steps:
1.  **Define a Callback Class:** Create an abstract class extending `uvm_callback` that defines the "hook" methods.
2.  **Register the Callback:** Use a macro to associate the callback class with the component it will attach to.
3.  **Invoke the Callback:** Use a macro within the component's source code to create the "hook point" where the callback methods will be executed.
4.  **Implement and Add:** Create a concrete implementation of the callback class and add an instance of it to a specific component instance in your test.

### Implementation Example

Let's add `pre_drive` and `post_drive` hooks to our `my_driver`.

**Step 1 & 2: Define and Register the Callback Class**

```systemverilog
// In tests/E2_customization_examples.sv

// 1. Define the abstract callback class with virtual methods
class my_driver_callbacks extends uvm_callback;
  `uvm_object_utils(my_driver_callbacks)

  // The "hook" methods that users can implement
  virtual task pre_drive(my_driver drv, my_transaction tx); endtask
  virtual task post_drive(my_driver drv, my_transaction tx); endtask
endclass

// 2. Register the callback with the component class (my_driver)
`uvm_register_cb(my_driver, my_driver_callbacks)
```

**Step 3: Invoke the Callbacks in the Driver**

You must modify the driver's source code once to add the hook points.

```systemverilog
// In the driver class
class my_driver extends uvm_driver #(my_transaction);
  `uvm_component_utils(my_driver)

  // The hook points for the callbacks
  `uvm_register_cb(my_driver, my_driver_callbacks)

  virtual task run_phase(uvm_phase phase);
    forever begin
      seq_item_port.get_next_item(req);

      // Invoke the pre_drive hook
      `uvm_do_callbacks(my_driver, my_driver_callbacks, pre_drive(this, req))

      // ... actual driver logic to wiggle pins ...

      // Invoke the post_drive hook
      `uvm_do_callbacks(my_driver, my_driver_callbacks, post_drive(this, req))

      seq_item_port.item_done();
    end
  endtask
endclass
```

**Step 4: Implement and Add the Callback in a Test**

Now, in a specific test, we can create a concrete callback to inject an error.

```systemverilog
// 1. Create a concrete implementation of the callback
class error_injector_cb extends my_driver_callbacks;
  `uvm_object_utils(error_injector_cb)

  // Implement only the hook we care about
  virtual task pre_drive(my_driver drv, my_transaction tx);
    if (tx.addr == 32'hBAD_ADDR) begin
      `uvm_info("CB/INJECT", "Injecting error for bad address", UVM_MEDIUM)
      // Corrupt the data before it's driven
      tx.data = 32'hBAADF00D;
    end
  endtask
endclass

// 2. In the test, add an instance of the callback to the driver
function void my_error_test::build_phase(uvm_phase phase);
  super.build_phase(phase);
  // ... build the environment ...

  error_injector_cb cb = error_injector_cb::type_id::create("cb");
  uvm_callback_pool#(my_driver, my_driver_callbacks)::add(env.agent.driver, cb);
endfunction
```

## Conclusion: Power and Complexity

Customizing TLM, reporting, and using callbacks are powerful, expert-level techniques. They allow you to tailor the UVM framework to your exact needs, leading to more efficient and maintainable verification environments. However, they also add layers of abstraction and complexity. Use them judiciously where the benefits of customization outweigh the cost of increased complexity.
