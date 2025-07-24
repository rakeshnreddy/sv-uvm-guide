class packet; bit [1:0] typ; int size; endclass

class monitor;
  covergroup cg;
    cp_type: coverpoint pkt.typ;
    cp_size: coverpoint pkt.size;
  endgroup
  packet pkt;
  function new(); cg = new(); endfunction
  function void write(packet p); pkt = p; cg.sample(); endfunction
endclass
