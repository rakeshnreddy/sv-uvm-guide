// compile
// RAL Mirror Bug lab: starter.
// The run ends with UVM_ERROR reports. Find out why from the log, fix the
// environment, and repeat until the run is clean. See README.md.
`timescale 1ns/1ps
`include "uvm_macros.svh"

// ------------------------------------------------------------------ bus interface
// One transfer per clock in which valid is 1; the DUT is always ready.
interface codec_if (input logic clk, input logic rst_n);
  logic        valid, write;
  logic [7:0]  addr;
  logic [31:0] wdata, rdata;

  // #1step samples the value just before the edge, so the driver and the
  // monitor see the same read data.
  clocking drv_cb @(posedge clk);
    default input #1step output #0;
    output valid, write, addr, wdata;
    input  rdata, rst_n;
  endclocking

  clocking mon_cb @(posedge clk);
    default input #1step;
    input valid, write, addr, wdata, rdata, rst_n;
  endclocking
endinterface

// ------------------------------------------------------------------------ the DUT
// 'h00 CFG   GAIN[31:0] RW
// 'h04 CTRL  EN[0] RW, LED[1] W1T
// 'h08 IRQ   ERR[0] W1C; the hardware sets ERR when a write hits no register
module codec_regs (codec_if bus);
  logic [31:0] gain;
  logic        en, led, err;
  wire         wr     = bus.valid && bus.write;
  wire         mapped = bus.addr inside {8'h00, 8'h04, 8'h08};

  always_ff @(posedge bus.clk or negedge bus.rst_n) begin
    if (!bus.rst_n) begin
      gain <= '0;
      en   <= 1'b0;
      led  <= 1'b0;
      err  <= 1'b0;
    end else begin
      if (wr && bus.addr == 8'h00) gain <= bus.wdata;
      if (wr && bus.addr == 8'h04) begin
        en  <= bus.wdata[0];
        led <= led ^ bus.wdata[1];                 // write 1 to toggle
      end
      if (wr && bus.addr == 8'h08 && bus.wdata[0]) err <= 1'b0;  // write 1 to clear
      else if (wr && !mapped)                      err <= 1'b1;  // decode error
    end
  end

  always_comb begin
    case (bus.addr)
      8'h00:   bus.rdata = gain;
      8'h04:   bus.rdata = {30'd0, led, en};
      8'h08:   bus.rdata = {31'd0, err};
      default: bus.rdata = '0;
    endcase
  end
endmodule

package codec_pkg;
  import uvm_pkg::*;

  // ------------------------------------------------------------- agent classes
  class codec_item extends uvm_sequence_item;
    `uvm_object_utils(codec_item)
    bit        write;
    bit [7:0]  addr;
    bit [31:0] data;   // write data, or the read data the driver fills in
    function new(string name = "codec_item");
      super.new(name);
    endfunction
    function string convert2string();
      return $sformatf("%s addr='h%0h data='h%0h", write ? "WR" : "RD", addr, data);
    endfunction
  endclass

  typedef uvm_sequencer #(codec_item) codec_sqr;

  class codec_drv extends uvm_driver #(codec_item);
    `uvm_component_utils(codec_drv)
    virtual codec_if vif;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      if (!uvm_config_db#(virtual codec_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "codec_drv has no virtual interface")
    endfunction
    task run_phase(uvm_phase phase);
      vif.drv_cb.valid <= 1'b0;
      do @(vif.drv_cb); while (!vif.drv_cb.rst_n);
      forever begin
        seq_item_port.get_next_item(req);
        vif.drv_cb.valid <= 1'b1;
        vif.drv_cb.write <= req.write;
        vif.drv_cb.addr  <= req.addr;
        vif.drv_cb.wdata <= req.data;
        @(vif.drv_cb);                         // the transfer happens at this edge
        if (!req.write) req.data = vif.drv_cb.rdata;
        vif.drv_cb.valid <= 1'b0;
        @(vif.drv_cb);                         // the monitor published one edge ago
        seq_item_port.item_done();
      end
    endtask
  endclass

  class codec_mon extends uvm_monitor;
    `uvm_component_utils(codec_mon)
    virtual codec_if vif;
    uvm_analysis_port #(codec_item) ap;
    function new(string name, uvm_component parent);
      super.new(name, parent);
      ap = new("ap", this);
    endfunction
    function void build_phase(uvm_phase phase);
      if (!uvm_config_db#(virtual codec_if)::get(this, "", "vif", vif))
        `uvm_fatal("NOVIF", "codec_mon has no virtual interface")
    endfunction
    task run_phase(uvm_phase phase);
      forever begin
        @(vif.mon_cb);
        if (vif.mon_cb.rst_n && vif.mon_cb.valid) begin
          codec_item t = codec_item::type_id::create("t");
          t.write = vif.mon_cb.write;
          t.addr  = vif.mon_cb.addr;
          t.data  = vif.mon_cb.wdata;
          ap.write(t);
        end
      end
    endtask
  endclass

  class codec_agent extends uvm_agent;
    `uvm_component_utils(codec_agent)
    codec_sqr sqr;
    codec_drv drv;
    codec_mon mon;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      sqr = codec_sqr::type_id::create("sqr", this);
      drv = codec_drv::type_id::create("drv", this);
      mon = codec_mon::type_id::create("mon", this);
    endfunction
    function void connect_phase(uvm_phase phase);
      drv.seq_item_port.connect(sqr.seq_item_export);
    endfunction
  endclass

  // A plain bus write that the register model does not start. It stands in for
  // the CPU's boot firmware, which shares this bus.
  class fw_write_seq extends uvm_sequence #(codec_item);
    `uvm_object_utils(fw_write_seq)
    bit [7:0]  addr;
    bit [31:0] data;
    function new(string name = "fw_write_seq");
      super.new(name);
    endfunction
    task body();
      req = codec_item::type_id::create("req");
      start_item(req);
      req.write = 1'b1;
      req.addr  = addr;
      req.data  = data;
      finish_item(req);
    endtask
  endclass

  // ------------------------------------------------------------ register layer
  class codec_adapter extends uvm_reg_adapter;
    `uvm_object_utils(codec_adapter)
    function new(string name = "codec_adapter");
      super.new(name);
      supports_byte_enable = 0;  // the bus has no byte strobes
      provides_responses   = 0;  // the driver writes read data into the request
    endfunction
    virtual function uvm_sequence_item reg2bus(const ref uvm_reg_bus_op rw);
      codec_item t = codec_item::type_id::create("t");
      t.write = (rw.kind == UVM_WRITE);
      t.addr  = rw.addr;
      t.data  = rw.data;
      return t;
    endfunction
    virtual function void bus2reg(uvm_sequence_item bus_item,
                                  ref uvm_reg_bus_op rw);
      codec_item t;
      if (!$cast(t, bus_item))
        `uvm_fatal("NOT_CODEC", "bus2reg was given an item that is not a codec_item")
      rw.kind   = t.write ? UVM_WRITE : UVM_READ;
      rw.addr   = t.addr;
      rw.data   = t.data;
      rw.status = UVM_IS_OK;     // this bus has no error response
    endfunction
  endclass

  class cfg_reg extends uvm_reg;
    `uvm_object_utils(cfg_reg)
    rand uvm_reg_field gain;
    function new(string name = "cfg_reg");
      super.new(name, 32, UVM_NO_COVERAGE);
    endfunction
    virtual function void build();
      gain = uvm_reg_field::type_id::create("gain");
      // parent, size, lsb, access, volatile, reset, has_reset, is_rand, indv
      gain.configure(this, 32, 0, "RW", 0, 32'h0, 1, 1, 0);
    endfunction
  endclass

  class ctrl_reg extends uvm_reg;
    `uvm_object_utils(ctrl_reg)
    rand uvm_reg_field en, led;
    function new(string name = "ctrl_reg");
      super.new(name, 32, UVM_NO_COVERAGE);
    endfunction
    virtual function void build();
      en  = uvm_reg_field::type_id::create("en");
      led = uvm_reg_field::type_id::create("led");
      en.configure (this, 1, 0, "RW",  0, 1'b0, 1, 1, 0);
      led.configure(this, 1, 1, "W1T", 0, 1'b0, 1, 0, 0);
    endfunction
  endclass

  class irq_reg extends uvm_reg;
    `uvm_object_utils(irq_reg)
    uvm_reg_field err;
    function new(string name = "irq_reg");
      super.new(name, 32, UVM_NO_COVERAGE);
    endfunction
    virtual function void build();
      err = uvm_reg_field::type_id::create("err");
      // Not volatile: the hardware sets ERR only on an event the test causes,
      // and the test reads IRQ before it checks it.
      err.configure(this, 1, 0, "W1C", 0, 1'b0, 1, 0, 0);
    endfunction
  endclass

  class codec_block extends uvm_reg_block;
    `uvm_object_utils(codec_block)
    rand cfg_reg  cfg;
    rand ctrl_reg ctrl;
    rand irq_reg  irq;
    function new(string name = "codec_block");
      super.new(name, UVM_NO_COVERAGE);
    endfunction
    virtual function void build();
      cfg = cfg_reg::type_id::create("cfg");
      cfg.configure(this);
      cfg.build();
      ctrl = ctrl_reg::type_id::create("ctrl");
      ctrl.configure(this);
      ctrl.build();
      irq = irq_reg::type_id::create("irq");
      irq.configure(this);
      irq.build();
      default_map = create_map("default_map", 'h0, 4, UVM_LITTLE_ENDIAN);
      default_map.add_reg(cfg,  'h00, "RW");
      default_map.add_reg(ctrl, 'h04, "RW");
      default_map.add_reg(irq,  'h08, "RW");
      lock_model();
    endfunction
  endclass

  // ------------------------------------------------------------- env and test
  class codec_env extends uvm_env;
    `uvm_component_utils(codec_env)
    codec_agent                     agent;
    codec_block                     ral;
    codec_adapter                   adapter;
    uvm_reg_predictor #(codec_item) predictor;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      agent     = codec_agent::type_id::create("agent", this);
      predictor = uvm_reg_predictor #(codec_item)::type_id::create("predictor", this);
      adapter   = codec_adapter::type_id::create("adapter");
      ral       = codec_block::type_id::create("ral");
      ral.build();
    endfunction
    function void connect_phase(uvm_phase phase);
      ral.default_map.set_sequencer(agent.sqr, adapter);
      ral.default_map.set_auto_predict(1);   // mirror follows register accesses
      predictor.map     = ral.default_map;
      predictor.adapter = adapter;
    endfunction
  endclass

  class codec_test extends uvm_test;
    `uvm_component_utils(codec_test)
    codec_env env;
    function new(string name, uvm_component parent);
      super.new(name, parent);
    endfunction
    function void build_phase(uvm_phase phase);
      env = codec_env::type_id::create("env", this);
    endfunction

    function void check_ok(uvm_status_e st, string what);
      if (st != UVM_IS_OK) `uvm_error("ACCESS", {what, " returned ", st.name()})
    endfunction

    task run_phase(uvm_phase phase);
      uvm_status_e   st;
      uvm_reg_data_t rd;
      fw_write_seq   fw;
      phase.raise_objection(this);

      // The test's own register accesses.
      env.ral.ctrl.write(st, 'h3);             // EN = 1, LED toggles to 1
      check_ok(st, "ctrl.write");
      env.ral.cfg.write(st, 'h55);
      check_ok(st, "cfg.write");

      // Boot firmware rewrites CFG over the same bus.
      fw = fw_write_seq::type_id::create("fw");
      fw.addr = 8'h00;
      fw.data = 32'hA5;
      fw.start(env.agent.sqr);

      // Firmware probes an address with no register: the DUT sets IRQ.ERR.
      fw = fw_write_seq::type_id::create("fw_probe");
      fw.addr = 8'hFC;
      fw.data = '0;
      fw.start(env.agent.sqr);

      // The DUT must report the error, and the model must learn it from the read.
      env.ral.irq.read(st, rd);
      check_ok(st, "irq.read");
      if (rd != 1)
        `uvm_error("READ", $sformatf("IRQ read 'h%0h, expected 'h1", rd))
      env.ral.irq.mirror(st, UVM_CHECK);
      check_ok(st, "irq.mirror");

      // Clear the error, then check every register against its mirror.
      env.ral.irq.write(st, 'h1);
      check_ok(st, "irq.write");
      env.ral.cfg.mirror(st, UVM_CHECK);
      check_ok(st, "cfg.mirror");
      env.ral.ctrl.mirror(st, UVM_CHECK);
      check_ok(st, "ctrl.mirror");
      env.ral.irq.mirror(st, UVM_CHECK);
      check_ok(st, "irq.mirror");

      `uvm_info("TEST", "register checks complete", UVM_LOW)
      phase.drop_objection(this);
    endtask
  endclass
endpackage

module tb_top;
  import uvm_pkg::*;
  import codec_pkg::*;

  logic clk   = 1'b0;
  logic rst_n = 1'b0;
  always #5 clk = ~clk;

  codec_if   bus (.clk(clk), .rst_n(rst_n));
  codec_regs dut (.bus(bus));

  // Release reset on a falling edge so it never races the DUT's flops.
  initial begin
    repeat (2) @(negedge clk);
    rst_n <= 1'b1;
  end

  initial begin
    uvm_config_db#(virtual codec_if)::set(null, "uvm_test_top.env.agent.*", "vif", bus);
    run_test("codec_test");
  end
endmodule
