# Example run commands, labelled by simulator. The bench needs no UVM library.
# Any IEEE 1800-2023 simulator that supports semaphores and fork-join can run it:
# compile the file with tb_top as the top module and run to completion.

# Synopsys VCS
vcs:
	vcs -sverilog src/testbench.sv -o simv && ./simv

vcs-solution:
	vcs -sverilog solution/testbench.sv -o simv && ./simv

.PHONY: vcs vcs-solution
