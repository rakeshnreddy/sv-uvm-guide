/*
 * Simplified generated target: C bare-metal test for mem_read_write_test
 * Source intent: solution/mem_test.pss
 *
 * The PSS tool solved the scenario (here addr = 0x1040, data = 0xBEEF),
 * then pasted each action's `exec body C` template in the solved order,
 * with every {{...}} reference replaced by its solved value.
 * Real tools differ in naming and structure; some solve at run time instead.
 */

#include <stdint.h>
#include "mem_test_platform.h" /* mem_write32(), mem_read32(), test_fail() */

void mem_read_write_test(void) {
    /* wr_a: do write_mem */
    mem_write32(0x00001040u, 0x0000BEEFu);

    /* rd_a: do read_verify (bound to wr_a.wr, so the same address and data) */
    if (mem_read32(0x00001040u) != 0x0000BEEFu)
        test_fail("read-after-write mismatch");
}
