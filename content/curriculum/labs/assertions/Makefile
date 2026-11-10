# Makefile for lab assertions-1 (valid/ready handshake assertions).
#
# Tool-neutral: the lab needs only a simulator that supports IEEE 1800-2023
# immediate, deferred and concurrent assertions. No UVM library is needed.
#
# Pick a recipe with SIM=verilator, SIM=questa, SIM=xcelium or SIM=vcs, or
# give your own commands with COMPILE="..." RUN="...". The verilator recipe is
# the one the expected outputs in the README were captured with (Verilator
# 5.052). The questa, xcelium and vcs recipes are examples: check the switch
# names against your simulator's manual.
#
# Verilator switches used below:
#   --binary --timing   build a runnable model; --timing for the # delays,
#                       the clocking block and the fork/wait in tb_top
#   --assert            enable assertions
#   --coverage-user     enable cover property, so its pass statement runs
#                       (without it both cover counts stay at 0)
#   +verilator+error+limit+100   keep running after $error (by default the
#                       first $error stops the run)
#
#   make run      SIM=<tool>   your checker (tb/hs_slice_sva.sv) on the design (rtl/hs_slice.sv)
#   make nostall  SIM=<tool>   the same, with +NO_STALL (the sink never stalls)
#   make run      SIM=<tool> PLUSARGS=+PAUSE=6   the sink stalls for 6 edges
#   make solution       SIM=<tool>   the solution checker on the design as given
#   make solution-fixed SIM=<tool>   the solution checker on the fixed design

TOP      := tb_top
DUT      ?= rtl/hs_slice.sv
SVA      ?= tb/hs_slice_sva.sv
TB       := tb/tb_top.sv
SRCS      = $(DUT) $(SVA) $(TB)
PLUSARGS ?=
SIM      ?=

ifeq ($(SIM),verilator)
  COMPILE ?= verilator --binary --timing --assert --coverage-user $(SRCS) --top-module $(TOP) -Mdir obj_dir
  RUN     ?= ./obj_dir/V$(TOP) +verilator+error+limit+100 $(PLUSARGS)
else ifeq ($(SIM),questa)
  COMPILE ?= vlib work && vlog -sv $(SRCS)
  RUN     ?= vsim -c $(TOP) $(PLUSARGS) -do "run -all; quit -f"
else ifeq ($(SIM),xcelium)
  COMPILE ?= true
  RUN     ?= xrun -sv $(SRCS) -top $(TOP) $(PLUSARGS)
else ifeq ($(SIM),vcs)
  COMPILE ?= vcs -sverilog $(SRCS) -top $(TOP) -o simv
  RUN     ?= ./simv $(PLUSARGS)
endif

.PHONY: help run nostall solution solution-fixed check-sim clean

help:
	@echo "Usage: make run SIM=verilator|questa|xcelium|vcs  (or COMPILE=\"...\" RUN=\"...\")"
	@echo "Targets: run, nostall, solution, solution-fixed, clean. See the comments at the top of this Makefile."

run: check-sim
	$(COMPILE)
	$(RUN)

nostall:
	$(MAKE) run PLUSARGS=+NO_STALL

solution:
	$(MAKE) run SVA=solution/hs_slice_sva.sv

solution-fixed:
	$(MAKE) run SVA=solution/hs_slice_sva.sv DUT=solution/hs_slice.sv

check-sim:
	@$(if $(and $(strip $(COMPILE)),$(strip $(RUN))),true,echo "No simulator selected: use SIM=verilator, SIM=questa, SIM=xcelium or SIM=vcs, or set COMPILE and RUN."; exit 1)

clean:
	rm -rf obj_dir work transcript vsim.wlf xcelium.d xrun.log xrun.history simv simv.daidir csrc ucli.key vc_hdrs.h *.log
