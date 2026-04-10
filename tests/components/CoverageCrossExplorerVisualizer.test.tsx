import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { CoverageCrossExplorerVisualizer } from '@/components/visualizers/CoverageCrossExplorerVisualizer';

describe('CoverageCrossExplorerVisualizer', () => {
    beforeEach(() => {
        render(<CoverageCrossExplorerVisualizer />);
    });

    it('renders without crashing and displays all 9 default cross cells', () => {
        expect(screen.getByTestId('coverage-cross-explorer')).toBeDefined();
        expect(screen.getByText('cp_addr × cp_op Cross Matrix')).toBeDefined();
        
        // Check 3x3 cells are present initially
        const opBins = ["READ", "WRITE", "BURST"];
        const addrBins = ["low", "mid", "high"];
        
        addrBins.forEach(addr => {
            opBins.forEach(op => {
                const cell = screen.getByTestId(`cross-cell-${addr}-${op}`);
                expect(cell).toBeDefined();
                expect(cell.textContent).toContain('0'); // 0 Hits initially
            });
        });
    });

    it('randomize button performs simulation and increases transaction count', async () => {
        const randomizeBtn = screen.getByRole('button', { name: /Randomize 10 Tx/i });
        fireEvent.click(randomizeBtn);
        
        const txCount = screen.getByText('10'); // 10 transactions added
        expect(txCount).toBeDefined();
        
        // At least one cell should have >0 hit count
        const opBins = ["READ", "WRITE", "BURST"];
        const addrBins = ["low", "mid", "high"];
        
        let foundHit = false;
        for (const addr of addrBins) {
            for (const op of opBins) {
                const cell = screen.getByTestId(`cross-cell-${addr}-${op}`);
                if (!cell.textContent?.includes('0Hits') && !cell.textContent?.includes('IGNORED')) {
                    const hits = parseInt(cell.textContent?.replace('Hits', '') || '0', 10);
                    if (hits > 0) {
                        foundHit = true;
                    }
                }
            }
        }
        
        expect(foundHit).toBe(true);
    });

    it('allow filtering ignore_bins', async () => {
        const cellLowRead = screen.getByTestId('cross-cell-low-READ');
        fireEvent.click(cellLowRead); // Ignore cell
        
        expect(cellLowRead.textContent).toContain('IGNORED');
        
        // Check if the generated covergroup code updates to show the ignore_bins directive
        // check if the covergroup code panel shows the ignore_bins low_READ
        const codePanel = screen.getByTestId('covergroup-code');
        expect(codePanel.textContent).toContain('ignore_bins low_READ');
    });

    it('updates coverage percentage appropriately when cells are hit', async () => {
         // Ignore 8 cells out of 9
         const opBins = ["READ", "WRITE", "BURST"];
         const addrBins = ["low", "mid", "high"];
         
         addrBins.forEach(addr => {
             opBins.forEach(op => {
                 if (addr === 'low' && op === 'READ') return; // leave one active
                 const cell = screen.getByTestId(`cross-cell-${addr}-${op}`);
                 fireEvent.click(cell);
             });
         });
         
         const randomizeBtn = screen.getByRole('button', { name: /Randomize 10 Tx/i });
         fireEvent.click(randomizeBtn);
         
         Array(10).fill(0).forEach(() => {
             fireEvent.click(randomizeBtn);
         });
         
         // At some point we should hit the low-READ since it's the only one
         await waitFor(() => {
            const pct = screen.getByText('100%');
            expect(pct).toBeDefined();
         });
    });
});
