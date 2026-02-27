class packet;
  rand byte length;
  rand byte payload[];
  byte crc; // Non-rand calculated field

  constraint c_length {
    length inside {[4:16]};
  }

  constraint c_payload_size {
    payload.size() == length;
  }

  // BUGGY: Solvers often cannot process complex mathematical reductions
  // or function calls during the primary decision phase.
  constraint c_crc {
    crc == payload.sum(item) with (item ^ 0); 
  }

  function void print();
    $display("Packet: length=%0d, payload_size=%0d, crc=0x%0h", length, payload.size(), crc);
  endfunction
endclass

program test;
  initial begin
    packet p = new();
    if (!p.randomize()) begin
      $display("Randomization failed!");
    end else begin
      p.print();
    end
  end
endprogram
