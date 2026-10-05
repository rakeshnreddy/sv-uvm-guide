// Lab ipc-deadlock (I-SV-5): two semaphore hangs, each part with its own watchdog.
// Fix the two lines marked BUG, rerun, and stop when the log ends with PASS=2 FAIL=0.
// IEEE 1800-2023: semaphores 15.3, fork-join 9.3.2, disable fork 9.6.3.
module tb_top;
  timeunit 1ns; timeprecision 1ns;

  // ---------------------------------------------------------------------------
  // Shared resources. Each has one key, recreated at the start of every part.
  // ---------------------------------------------------------------------------
  localparam int BUS = 0, TABLE_A = 1, TABLE_B = 2;
  string    res_name[3] = '{"bus", "table A", "table B"};
  semaphore key[3];                 // one key per resource
  string    holder[3];              // a semaphore does not record who holds its key
  int       users[3];               // above 1 means two threads shared a resource
  string    blocked_on[2];          // what each thread of the running part waits for
  int       collisions;
  int       passes, fails;

  // Takes resource r's key for thread t (0 or 1), with bookkeeping for the report.
  task automatic take_key(int t, int r, string who);
    blocked_on[t] = $sformatf("%s waits for the %s key", who, res_name[r]);
    key[r].get(1);
    blocked_on[t] = "";
    holder[r] = who;
    users[r]++;
    if (users[r] > 1) collisions++;
  endtask

  function automatic void give_key(int r);
    users[r]--;
    holder[r] = "nobody";
    key[r].put(1);
  endfunction

  // ---------------------------------------------------------------------------
  // Part 1: a sender and a receiver share one bus.
  // ---------------------------------------------------------------------------
  // Sends item i. A corrupt item is dropped, but the bus must be released either way.
  task automatic send_item(int i);
    take_key(0, BUS, $sformatf("sender (item %0d)", i));
    #20;                                      // drive the item on the bus
    if (i == 2) begin                         // item 2 is corrupt: drop it
      $display("[%0t] sender: item %0d is corrupt, dropped", $time, i);
      return;                                 // BUG 1: this path keeps the bus key
    end
    $display("[%0t] sender: item %0d sent", $time, i);
    give_key(BUS);
  endtask

  task automatic sender();
    for (int i = 0; i < 5; i++) begin
      #10;
      send_item(i);
    end
  endtask

  task automatic receiver();
    for (int i = 0; i < 5; i++) begin
      #15;
      take_key(1, BUS, $sformatf("receiver (read %0d)", i));
      #15;                                    // read from the bus
      $display("[%0t] receiver: read %0d done", $time, i);
      give_key(BUS);
    end
  endtask

  // ---------------------------------------------------------------------------
  // Part 2: a mover and an auditor both need table A and table B at once.
  // ---------------------------------------------------------------------------
  task automatic mover();                     // copies entries from table A to table B
    for (int i = 0; i < 3; i++) begin
      take_key(0, TABLE_A, "mover");
      #2;                                     // read table A
      take_key(0, TABLE_B, "mover");
      #2;                                     // write table B
      give_key(TABLE_B);
      give_key(TABLE_A);
      $display("[%0t] mover: entry %0d moved", $time, i);
      #6;
    end
  endtask

  task automatic auditor();                   // checks that the two tables agree
    for (int i = 0; i < 3; i++) begin
      #1;
      take_key(1, TABLE_B, "auditor");        // BUG 2: the mover takes table A first
      #2;                                     // read table B
      take_key(1, TABLE_A, "auditor");
      #2;                                     // compare with table A
      give_key(TABLE_A);
      give_key(TABLE_B);
      $display("[%0t] auditor: check %0d done", $time, i);
      #4;
    end
  endtask

  // ---------------------------------------------------------------------------
  // Harness: you do not need to edit anything below this line.
  // ---------------------------------------------------------------------------
  // Every resource must end the part with exactly the one key it started with.
  function automatic bit keys_back();
    foreach (key[r]) begin
      if (!key[r].try_get(1)) return 0;       // a key is missing
      if (key[r].try_get(1)) return 0;        // an extra key appeared
      key[r].put(1);
    end
    return 1;
  endfunction

  // Runs one part's two threads and gives up after budget_ns.
  task automatic run_part(int part, int unsigned budget_ns);
    bit finished = 0;
    foreach (key[r]) begin
      key[r] = new(1);
      holder[r] = "nobody";
      users[r] = 0;
    end
    blocked_on = '{default: ""};
    collisions = 0;
    fork begin                                // own parent: disable fork stays in here
      fork
        begin
          fork
            if (part == 1) sender(); else mover();
            if (part == 1) receiver(); else auditor();
          join
          finished = 1;
        end
        #(budget_ns);                         // this part's watchdog
      join_any
      disable fork;                           // stop the timer, or the stuck threads
    end join
    if (!finished) begin
      fails++;
      $display("[%0t] PART %0d FAIL: threads still blocked after %0d ns",
               $time, part, budget_ns);
      foreach (blocked_on[t])
        if (blocked_on[t] != "") $display("[%0t]   %s", $time, blocked_on[t]);
      foreach (holder[r])
        if (holder[r] != "nobody")
          $display("[%0t]   the %s key is held by %s", $time, res_name[r], holder[r]);
    end else if (collisions != 0) begin
      fails++;
      $display("[%0t] PART %0d FAIL: two threads used one resource at once",
               $time, part);
    end else if (!keys_back()) begin
      fails++;
      $display("[%0t] PART %0d FAIL: a resource did not end with exactly one key",
               $time, part);
    end else begin
      passes++;
      $display("[%0t] PART %0d PASS", $time, part);
    end
  endtask

  initial begin
    run_part(1, 300);
    run_part(2, 100);
    $display("[%0t] PASS=%0d FAIL=%0d", $time, passes, fails);
    if (fails != 0) $fatal(1, "%0d of 2 parts failed", fails);
    $finish;
  end
endmodule
