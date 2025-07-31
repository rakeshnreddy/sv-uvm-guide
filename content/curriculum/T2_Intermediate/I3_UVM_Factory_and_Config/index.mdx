---
title: "I3 – UVM Factory and Configuration"
description: "Learn how to use the UVM factory and configuration database (uvm_config_db) to build flexible and reusable testbenches."
---

import { Quiz, InteractiveCode } from '@/components/ui';

## The UVM Factory: Building with Flexibility

### The Problem: Why Not Just `new()`?

In standard SystemVerilog, we create objects using the `new()` constructor. For example:

```systemverilog
my_driver drv = new();
```

This is simple, but it's also rigid. If we want to use a different, modified driver for a specific test, we have to go into the environment code and change the line to:

```systemverilog
my_special_driver drv = new();
```

This is not ideal. We want to be able to change the components of our testbench without modifying the environment code itself.

### Factory Registration

The UVM factory solves this problem. To use the factory, we first need to register our classes with it using the `uvm_component_utils` and `uvm_object_utils` macros.

```systemverilog
class my_driver extends uvm_driver;
  `uvm_component_utils(my_driver)
  // ...
endclass
```

### Factory Creation

Once a class is registered, we can use the factory to create instances of it.

```systemverilog
my_driver drv;
drv = my_driver::type_id::create("drv", this);
```

The `create()` method takes two arguments:

- **name:** A string that gives the instance a unique name within its parent.
- **parent:** A handle to the parent component in the UVM hierarchy.

### Factory Overrides

The real power of the factory comes from its ability to override types. We can tell the factory to create an object of a different type whenever it's asked for a specific type.

#### Type Override

A type override replaces all instances of a given type with a different type.

```systemverilog
// In the test
factory.set_type_override_by_type(my_driver::get_type(), my_special_driver::get_type());
```

Now, whenever the factory is asked to create a `my_driver`, it will create a `my_special_driver` instead.

#### Instance Override

An instance override replaces a specific instance of a component with a different type.

```systemverilog
// In the test
factory.set_inst_override_by_type("env.agent.driver", my_driver::get_type(), my_special_driver::get_type());
```

This will only override the driver instance at the path `env.agent.driver`.

## The Configuration Database (`uvm_config_db`)

### The Problem: Configuring Components

How do we get data from the top-level test down to a deeply nested component? For example, how do we tell a driver which mode to operate in? Passing arguments down through every constructor is clumsy and error-prone.

### `set` and `get`

The `uvm_config_db` is a centralized database for configuration data. We can use it to `set` values at a higher level in the hierarchy and `get` them at a lower level.

#### `uvm_config_db::set()`

```systemverilog
uvm_config_db#(type)::set(this, "instance_path", "field_name", value);
```

- **type:** The data type of the value being set.
- **this:** A handle to the component that is setting the value.
- **instance_path:** The path to the component that will receive the value.
- **field_name:** The name of the configuration field.
- **value:** The value to set.

#### `uvm_config_db::get()`

```systemverilog
if (!uvm_config_db#(type)::get(this, "", "field_name", value))
  `uvm_error("CONFIG", "Failed to get field_name")
```

The `get()` call is usually placed in the `build_phase` of the component that needs the data.

### Virtual Interfaces

The most common use case for the `uvm_config_db` is passing down virtual interface handles from the static top-level module to the UVM components.

```systemverilog
// In the top-level module
initial begin
  uvm_config_db#(virtual my_if)::set(null, "uvm_test_top", "vif", vif);
  run_test();
end

// In the driver's build_phase
if (!uvm_config_db#(virtual my_if)::get(this, "", "vif", vif))
  `uvm_fatal("VIF", "Failed to get virtual interface")
```

## Best Practices

- Always use the factory to create UVM components and objects.
- Use the `uvm_*_utils` macros in all your UVM classes.
- Use the `uvm_config_db` to configure your testbench, not hard-coded values.
- Do `config_db::set` in a higher-level component (like a test) and `config_db::get` in the `build_phase` of the target component.
