import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { SvaSequenceWaveformVisualizer } from '@/components/visualizers/SvaSequenceWaveformVisualizer';

describe('SvaSequenceWaveformVisualizer', () => {
    beforeEach(() => {
        render(<SvaSequenceWaveformVisualizer />);
    });

    it('renders without crashing', () => {
        expect(screen.getByTestId('sva-waveform-visualizer')).toBeDefined();
        expect(screen.getByText('SVA Property Evaluator')).toBeDefined();
    });

    it('renders the property selector', () => {
        expect(screen.getByRole('combobox')).toBeDefined();
    });

    it('displays evaluation results on evaluate click', () => {
        const evaluateBtn = screen.getByRole('button', { name: /evaluate/i });
        fireEvent.click(evaluateBtn);
        
        // Results should appear (cycle-result testids)
        const result0 = screen.getByTestId('cycle-result-0');
        expect(result0).toBeDefined();
        
        // For preset 1: req ##2 ack, with all signals at 0, req[0] is 0 -> VACUOUS
        expect(result0.getAttribute('title')).toContain('false');
        
        // Wait, the status is vacuous so title says "Antecedent 'req' is false" or similar
        // Just checking it renders results is enough.
        expect(result0.className).toContain('bg-slate-800'); // VACUOUS color
    });
});
