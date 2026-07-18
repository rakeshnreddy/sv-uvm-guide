class axi_scoreboard extends uvm_scoreboard;
  `uvm_component_utils(axi_scoreboard)

  uvm_analysis_imp_expected #(axi_transaction, axi_scoreboard) expected_export;
  uvm_analysis_imp_actual #(axi_transaction, axi_scoreboard) actual_export;
  axi_transaction expected_reads[int unsigned][$];

  function new(string name, uvm_component parent);
    super.new(name, parent);
    expected_export = new("expected_export", this);
    actual_export = new("actual_export", this);
  endfunction

  virtual function void write_expected(axi_transaction txn);
    if (!txn.is_write) expected_reads[txn.id].push_back(txn);
  endfunction

  virtual function void write_actual(axi_transaction txn);
    axi_transaction expected;
    uvm_comparer comparer = new();
    if (txn.is_write) return;

    // TODO: reject unknown IDs, pop the oldest expected transaction for this ID,
    // and compare the complete burst using do_compare()/uvm_comparer.
    // Delete an empty per-ID queue after matching.
  endfunction

  virtual function void check_phase(uvm_phase phase);
    super.check_phase(phase);
    foreach (expected_reads[id]) begin
      if (expected_reads[id].size() != 0)
        `uvm_error("MISSING", $sformatf("ID %0d still has %0d expected read(s)", id, expected_reads[id].size()))
    end
  endfunction
endclass
