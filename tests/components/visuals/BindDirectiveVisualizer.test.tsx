import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BindDirectiveVisualizer from '@/components/visuals/BindDirectiveVisualizer';

describe('BindDirectiveVisualizer', () => {
  it('renders default state without bind active', () => {
    render(<BindDirectiveVisualizer />);
    
    expect(screen.getByText('The `bind` Directive')).toBeInTheDocument();
    expect(screen.getByText('Execute Bind')).toBeInTheDocument();
  });

  it('toggles bind state on click', () => {
    render(<BindDirectiveVisualizer />);
    
    const bindBtn = screen.getByRole('button', { name: /Execute Bind/i });
    fireEvent.click(bindBtn);

    // Button should now say "Remove Bind"
    expect(screen.getByText('Remove Bind')).toBeInTheDocument();

    // The visualizer dynamically updates classes to show the checker, but the 
    // checker text is always in the DOM (hidden by CSS max-height/opacity).
    // We can at least check that the button toggles back.
    fireEvent.click(bindBtn);
    expect(screen.getByText('Execute Bind')).toBeInTheDocument();
  });

  it('switches between bind by module and bind by instance', () => {
    render(<BindDirectiveVisualizer />);
    
    // Default is binding by target module. 'ahb_slave' appears in source and hierarchy
    expect(screen.getAllByText('ahb_slave').length).toBeGreaterThanOrEqual(1);

    // Switch to instance
    const instanceBtn = screen.getByRole('button', { name: /Bind by Specific Instance/i });
    fireEvent.click(instanceBtn);

    // The code syntax box should now show the instance path
    expect(screen.getByText('tb_top.u_slave_0')).toBeInTheDocument();
  });
});
