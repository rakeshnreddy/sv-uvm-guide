# Lab: Semaphore hangs, a leaked key and a circular wait

**Module:** I-SV-5 Synchronization and IPC. Read the [module page](/curriculum/T2_Intermediate/I-SV-5_Synchronization_and_IPC/index) first, especially "Deadlock, lost wake-ups and starvation: read the wait-for graph".

**You will practise:** reading a watchdog report, drawing the wait-for graph of a stuck bench, and fixing two semaphore hangs so that a self-checking bench ends with `PASS=2 FAIL=0`.

## The bench

`src/testbench.sv` runs two small tests, called parts, one after the other. Each part starts two threads that share resources through one-key semaphores (IEEE 1800-2023 §15.3), and each part has its own watchdog.

- **Part 1:** a `sender` and a `receiver` share one bus. The sender sends items 0 to 4 and must drop item 2, which is corrupt. The receiver reads from the bus five times.
- **Part 2:** a `mover` and an `auditor` both need table A and table B at the same time.

The harness at the bottom of the file wraps every key in `take_key()` and `give_key()`. Those helpers record what each thread is waiting for and who holds each key, two things a semaphore does not record for you. A part passes only if all three checks hold:

1. no thread is still blocked when the part's time budget runs out;
2. no two threads hold one resource's key at the same time;
3. every resource ends the part with exactly the one key it started with.

Two lines are marked `BUG 1` and `BUG 2`. Read the report before you look at them.

## Run it

Use any simulator that supports IEEE 1800-2023 semaphores and `fork`-`join`; no UVM library is needed. Compile `src/testbench.sv` with `tb_top` as the top module and run it to completion. The `Makefile` shows the commands for one simulator (`make vcs`); other simulators need their own equivalent commands.

## Step 1: Run the starter and read the report

The starter prints this log, followed by your simulator's own `$fatal` message. The log is illustrative: it was traced by hand against the standard, not captured from a simulator.

```text
[30] sender: item 0 sent
[45] receiver: read 0 done
[65] sender: item 1 sent
[80] receiver: read 1 done
[100] sender: item 2 is corrupt, dropped
[300] PART 1 FAIL: threads still blocked after 300 ns
[300]   sender (item 3) waits for the bus key
[300]   receiver (read 2) waits for the bus key
[300]   the bus key is held by sender (item 2)
[400] PART 2 FAIL: threads still blocked after 100 ns
[400]   mover waits for the table B key
[400]   auditor waits for the table A key
[400]   the table A key is held by mover
[400]   the table B key is held by auditor
[400] PASS=0 FAIL=2
```

Answer before you change anything:

1. In Part 1, which call holds the bus key, according to the report? Is that call still running?
2. In Part 2, which key does each thread hold, and which key does it wait for?
3. Without the per-part watchdog, how would this run end, and when? Hint: after 110 ns nothing is scheduled any more, and IEEE 1800-2023 §9.6.1 says that simulation then ends by itself, with no error.

## Step 2: Fix Part 1, the leaked key

Draw the wait-for graph: an arrow from each blocked thread to the key it waits for, and an arrow from each key to the call that holds it.

- The sender, now on item 3, waits for the bus key. The holder is `sender (item 2)`, a call of `send_item` that has already returned. An arrow that ends at something that will never act again is a **leaked key**, not a deadlock. Here the sender even waits for a key that its own earlier call took: a semaphore has no owner, so nothing stops a thread from blocking on itself.
- The receiver waits for the same key.

Find the path through `send_item` that never calls `give_key(BUS)`, and make every path return the key. Prefer one exit point at the end of the task to a `give_key()` before each `return`.

After the fix, Part 1 ends with `[185] PART 1 PASS`, and Part 2 still fails, now at 285 ns.

## Step 3: Fix Part 2, the circular wait

From the report, the mover holds table A and waits for table B, and the auditor holds table B and waits for table A. The arrows close into a loop: a **deadlock**. Neither thread printed a line, because both blocked before they reached their first `$display`.

Make both threads take the two keys in the same order. Either order works, as long as every thread uses it. The harness rejects two tempting fixes:

- giving a table's semaphore two keys: both threads get into one table at once, so check 2 fails;
- a `try_get()` retry loop that waits a little between tries but keeps the first key: the other thread stays blocked and the part times out, so check 1 fails. Without the wait, the loop never lets simulation time advance, so the run freezes at that time and even the watchdog never fires.

With both fixes the log ends like this:

```text
[185] receiver: read 4 done
[185] PART 1 PASS
[189] mover: entry 0 moved
[193] auditor: check 0 done
[199] mover: entry 1 moved
[203] auditor: check 1 done
[209] mover: entry 2 moved
[213] auditor: check 2 done
[217] PART 2 PASS
[217] PASS=2 FAIL=0
```

## Step 4: Explain what you saw

1. Why did the sender wait forever for a key that its own earlier call had taken? What does that tell you about who owns a semaphore key?
2. Part 2 printed nothing before it deadlocked. Which line would each thread have printed first, and why did neither reach it?
3. The harness checks for an extra key as well as a missing one. Which wrong Part 1 fix would leave an extra key? Hint: a `try_get()` whose result is ignored, followed by a `give_key()` that runs anyway.
4. When is release-and-retry (give back the first key, wait a random delay, try again) a better fix than a fixed order, and what goes wrong if both threads always wait the same delay?

Compare your file with `solution/testbench.sv` once you have recorded your answers.
