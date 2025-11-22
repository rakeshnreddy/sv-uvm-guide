import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ModportExplorer } from '@/components/visuals/ModportExplorer';

describe('ModportExplorer', () => {
    it('renders the component', () => {
        render(<ModportExplorer />);
        expect(screen.getByText('Modport Explorer')).toBeInTheDocument();
    });

    it('switches views when buttons are clicked', () => {
        render(<ModportExplorer />);

        // Default view is Master
        expect(screen.getByText('Master Driver')).toBeInTheDocument();
        expect(screen.getByText('(Uses master modport)')).toBeInTheDocument();

        // Switch to Slave
        fireEvent.click(screen.getByRole('button', { name: 'Slave' }));
        expect(screen.getAllByText('Slave DUT')[0]).toBeInTheDocument();
        expect(screen.getByText('(Uses slave modport)')).toBeInTheDocument();

        // Switch to Monitor
        fireEvent.click(screen.getByRole('button', { name: 'Monitor' }));
        expect(screen.getAllByText('Monitor')[0]).toBeInTheDocument();
        expect(screen.getByText('(Uses monitor modport)')).toBeInTheDocument();
    });
});
