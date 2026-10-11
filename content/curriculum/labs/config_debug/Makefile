# Example run commands, labelled by simulator. Any IEEE 1800-2023 simulator with the
# Accellera uvm-core 2020.3.1 library can run this lab: compile uvm_pkg, then ONE of
# src/dv/testbench.sv (starter) or solution/testbench.sv (solution), with tb_top as
# the top module, from this directory (the `include paths are relative to it).
# Other simulators need their own equivalent commands; see your simulator's manual.

UVM_HOME ?= $(HOME)/uvm-core
UVM_SRC  = +incdir+$(UVM_HOME)/src $(UVM_HOME)/src/uvm_pkg.sv $(UVM_HOME)/src/dpi/uvm_dpi.cc
RUN_ARGS = +UVM_CONFIG_DB_TRACE

# Synopsys VCS (example; check the switches against your VCS version)
vcs:
	vcs -sverilog +incdir+. $(UVM_SRC) src/dv/testbench.sv -top tb_top -o simv && ./simv $(RUN_ARGS)

vcs-solution:
	vcs -sverilog +incdir+. $(UVM_SRC) solution/testbench.sv -top tb_top -o simv && ./simv $(RUN_ARGS)

.PHONY: vcs vcs-solution
