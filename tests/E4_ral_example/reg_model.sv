`include "uvm_macros.svh"

// Register: ALU_OPCODE
class alu_opcode_reg extends uvm_reg;
  `uvm_object_utils(alu_opcode_reg)

  rand uvm_reg_field opcode;
  rand uvm_reg_field enable;

  function new(string name = "alu_opcode_reg");
    super.new(name, 32, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    this.opcode = uvm_reg_field::type_id::create("opcode");
    this.opcode.configure(this, 4, 0, "RW", 0, 4'h0, 1, 0, 1);

    this.enable = uvm_reg_field::type_id::create("enable");
    this.enable.configure(this, 1, 4, "RW", 0, 1'h0, 1, 0, 1);
  endfunction
endclass

// Register: ALU_STATUS (Read-Only)
class alu_status_reg extends uvm_reg;
    `uvm_object_utils(alu_status_reg)

    rand uvm_reg_field busy;

    function new(string name = "alu_status_reg");
        super.new(name, 32, UVM_NO_COVERAGE);
    endfunction

    virtual function void build();
        this.busy = uvm_reg_field::type_id::create("busy");
        this.busy.configure(this, 1, 0, "RO", 0, 1'h0, 1, 0, 0);
    endfunction
endclass

// Register Block
class alu_reg_block extends uvm_reg_block;
  `uvm_object_utils(alu_reg_block)

  rand alu_opcode_reg ALU_OPCODE;
  rand uvm_reg        ALU_OPERAND_A;
  rand uvm_reg        ALU_OPERAND_B;
  rand alu_status_reg ALU_STATUS;

  function new(string name = "alu_reg_block");
    super.new(name, UVM_NO_COVERAGE);
  endfunction

  virtual function void build();
    this.ALU_OPCODE = alu_opcode_reg::type_id::create("ALU_OPCODE");
    this.ALU_OPCODE.configure(this);
    this.ALU_OPCODE.build();

    this.ALU_OPERAND_A = uvm_reg::type_id::create("ALU_OPERAND_A");
    this.ALU_OPERAND_A.configure(this, 32);

    this.ALU_OPERAND_B = uvm_reg::type_id::create("ALU_OPERAND_B");
    this.ALU_OPERAND_B.configure(this, 32);

    this.ALU_STATUS = alu_status_reg::type_id::create("ALU_STATUS");
    this.ALU_STATUS.configure(this);
    this.ALU_STATUS.build();

    this.default_map = create_map("default_map", 0, 4, UVM_LITTLE_ENDIAN);
    this.default_map.add_reg(this.ALU_OPCODE,    'h00, "RW");
    this.default_map.add_reg(this.ALU_OPERAND_A, 'h04, "RW");
    this.default_map.add_reg(this.ALU_OPERAND_B, 'h08, "RW");
    this.default_map.add_reg(this.ALU_STATUS,    'h0C, "RO");
  endfunction
endclass
