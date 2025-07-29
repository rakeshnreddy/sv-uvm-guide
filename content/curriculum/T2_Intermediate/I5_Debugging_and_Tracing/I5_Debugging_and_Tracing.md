---
title: "I5 – Debugging and Tracing UVM Tests"
description: "Learn about common UVM debugging features, including verbosity control, the reporting mechanism, and phase/factory tracing."
---

import { Quiz, InteractiveCode } from '@/components/ui';

## The UVM Reporting Mechanism

### Report Macros

UVM provides four macros for reporting messages:

- **`uvm_info(ID, MESSAGE, VERBOSITY)`:** For general information.
- **`uvm_warning(ID, MESSAGE)`:** For warnings that don't necessarily indicate an error.
- **`uvm_error(ID, MESSAGE)`:** For errors that should be investigated.
- **`uvm_fatal(ID, MESSAGE)`:** For errors that should stop the simulation immediately.

### Verbosity Levels

Verbosity levels allow you to control the amount of output from your simulation.

- **`UVM_NONE`:** No messages are printed.
- **`UVM_LOW`:** Only the most important messages are printed.
- **`UVM_MEDIUM`:** The default verbosity level.
- **`UVM_HIGH`:** More detailed messages are printed.
- **`UVM_FULL`:** All messages are printed.

You can set the default verbosity from the `run_test` call or with a command-line plusarg:

```systemverilog
// In the top-level module
initial begin
  run_test("base_test");
end

// Command line
+UVM_VERBOSITY=UVM_HIGH
```

### Controlling Verbosity

You can change the verbosity for specific components or even specific IDs to finely tune the log file output.

```systemverilog
// In a test
uvm_top.set_report_verbosity_level_hier(UVM_HIGH);
uvm_top.set_report_id_verbosity_hier("MY_ID", UVM_LOW);
```

## Controlling Actions and Severity

### Actions

Each report can have an action associated with it (e.g., `DISPLAY`, `LOG`, `COUNT`, `EXIT`). You can change the action for a specific report ID.

```systemverilog
// In a test
uvm_top.set_report_id_action_hier("MY_ID", UVM_LOG | UVM_DISPLAY | UVM_EXIT);
```

### Severity

The severity of a report determines how it is treated by the reporting mechanism. By default, `uvm_error` will increment the error count but not stop the simulation. `uvm_fatal` will stop the simulation immediately. You can change the severity of a test.

```systemverilog
// In a test
uvm_top.set_report_severity_action_hier(UVM_ERROR, UVM_EXIT);
```

## Command Line Debugging

### Test Name

You can specify the test to run using `+UVM_TESTNAME`.

```bash
+UVM_TESTNAME=my_test
```

### Configuration Overrides

You can use `+uvm_set_config_int` or `+uvm_set_config_string` to change `uvm_config_db` settings from the command line.

```bash
+uvm_set_config_int=uvm_test_top.env.agent.drv,my_int,123
```

### Factory Overrides

You can use `+uvm_set_type_override` to perform factory overrides from the command line.

```bash
+uvm_set_type_override=my_driver,my_special_driver
```

## Built-in Tracing

### Phase Trace

`+UVM_PHASE_TRACE` can be used to see the UVM phases executing in order.

### Objection Trace

`+UVM_OBJECTION_TRACE` shows exactly which components are raising and dropping objections, helping to debug tests that end too early or never end.

### Factory Print

`factory.print()` can be used to see all the registered classes and current overrides.

## Debugging Checklist

- Is the correct test running? (`+UVM_TESTNAME`)
- Are the components configured correctly? (`+uvm_set_config_*`)
- Are the correct components being created? (`+uvm_set_type_override`, `factory.print()`)
- Is the test ending when it should? (`+UVM_OBJECTION_TRACE`)
- Is the phase execution order correct? (`+UVM_PHASE_TRACE`)
- Are there any errors or warnings? (Check the log file)
- Is the verbosity level appropriate? (`+UVM_VERBOSITY`)
