/*
 * Simplified generated target: C bare-metal test for mem_read_write_test
 * Source intent: solution/mem_test.pss
 */

#include <stdint.h>
#include "mem_test_platform.h"

#define MEM_BASE_ADDR  0x00001000u
#define MEM_LIMIT_ADDR 0x00001fffu

void mem_read_write_test(void) {
    uint32_t addr = rand_aligned_addr(MEM_BASE_ADDR, MEM_LIMIT_ADDR, 4u);
    uint32_t data = rand32() & 0x0000ffffu;
    uint32_t actual;

    mem_write32(addr, data);
    actual = mem_read32(addr);

    if (actual != data) {
        test_fail("addr=0x%08x expected=0x%08x actual=0x%08x",
                  addr, data, actual);
        return;
    }

    test_pass("read-after-write matched");
}
