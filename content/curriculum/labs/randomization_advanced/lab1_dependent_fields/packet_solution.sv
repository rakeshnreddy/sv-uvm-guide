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

  // GOOD: Sizing distribution hint for the solver
  constraint c_solve_order {
    solve length before payload; 
  }

  // CALLED AUTOMATICALLY BY randomize()
  function void post_randomize();
    byte calc_crc = 0;
    foreach(payload[i]) begin
      calc_crc = calc_crc ^ payload[i]; 
    end
    crc = calc_crc;
  endfunction

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
