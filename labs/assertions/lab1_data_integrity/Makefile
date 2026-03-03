# Makefile for Data Integrity Challenge Lab

# Default target
all: run

# Variables
FILES = dut.sv solution_assertions.sv testbench.sv

# Using Icarus Verilog for simplicity (Assuming the user has it, though SVA support in iverilog is limited. 
# Alternatively, using verilator or standard commercial tools. Here we provide a generic script that echoes instructions)
# Realistically, this guide likely assumes a specific simulator in its environment. 
# Let's provide a generic echo for now as we don't know the exact toolchain on the user's machine.

run:
	@echo "Compiling and running the lab requires a SystemVerilog simulator with SVA support."
	@echo "Example using Questa:"
	@echo "  vlog $(FILES)"
	@echo "  vsim -c testbench -do 'run -all; quit'"
	@echo ""
	@echo "Example using VCS:"
	@echo "  vcs -sverilog -assert $(FILES)"
	@echo "  ./simv"
	@echo ""
	@echo "Please run using your installed simulator."

clean:
	rm -rf work transcript vsim.wlf simv* csrc* *.log *.daidir
