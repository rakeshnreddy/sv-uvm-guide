import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TelemetryEventBusVisualizer from '@/components/visuals/TelemetryEventBusVisualizer';

describe('TelemetryEventBusVisualizer', () => {
  it('renders correctly with default state', () => {
    render(<TelemetryEventBusVisualizer />);
    expect(screen.getByText('Centralized Debug Event Bus')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Inject Traffic/i })).toBeInTheDocument();
  });

  it('injects traffic and updates logs', () => {
    render(<TelemetryEventBusVisualizer />);
    
    // Inject normal traffic
    const injectTrafficBtn = screen.getByRole('button', { name: /Inject Traffic/i });
    fireEvent.click(injectTrafficBtn);
    
    // Default time increments by 10ns
    expect(screen.getByText('Time: 10ns')).toBeInTheDocument();
    expect(screen.getByText('Packet driven successfully (ID: 402)')).toBeInTheDocument();
    expect(screen.getByText('INFO')).toBeInTheDocument();
  });

  it('injects error and updates waveform trigger state', () => {
    render(<TelemetryEventBusVisualizer />);
    
    // Inject error traffic
    const injectErrorBtn = screen.getByRole('button', { name: /Inject Error/i });
    fireEvent.click(injectErrorBtn);
    
    expect(screen.getByText('Time: 10ns')).toBeInTheDocument();
    expect(screen.getByText('Data mismatch: Expected 0xAA, got 0xAB')).toBeInTheDocument();
    expect(screen.getByText('ERROR')).toBeInTheDocument();
    
    // A red/amber banner or trigger text is displayed
    expect(screen.getByText('Executing $fsdbDumpvars...')).toBeInTheDocument();
  });

  it('injects hang and updates logs', () => {
    render(<TelemetryEventBusVisualizer />);
    
    // Inject hang traffic
    const injectHangBtn = screen.getByRole('button', { name: /Inject Hang/i });
    fireEvent.click(injectHangBtn);
    
    expect(screen.getByText('Time: 10ns')).toBeInTheDocument();
    expect(screen.getByText(/Watchdog Timeout/i)).toBeInTheDocument();
    expect(screen.getByText('FATAL')).toBeInTheDocument();
  });
});
