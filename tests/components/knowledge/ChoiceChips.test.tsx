import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChoiceChips, choiceChipClass, nextChoiceIndex } from '@/components/knowledge/ChoiceChips';
import { MAP_TIERS } from '@/components/knowledge/ModuleMap';

function Tiers() {
  const [value, setValue] = useState<string>('Foundational');
  return <ChoiceChips label="Tier shown on the map" options={MAP_TIERS} value={value} onChange={setValue} />;
}

describe('ChoiceChips', () => {
  it('is a labelled radio group with one tab stop, on the chosen chip', () => {
    render(<Tiers />);
    const group = screen.getByRole('radiogroup', { name: 'Tier shown on the map' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4']);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('moves and chooses with the arrow keys, Home and End, and wraps around', () => {
    render(<Tiers />);
    const radio = (name: string) => screen.getByRole('radio', { name });
    fireEvent.keyDown(radio('Tier 1'), { key: 'ArrowRight' });
    expect(radio('Tier 2')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Tier 2')).toHaveFocus();
    fireEvent.keyDown(radio('Tier 2'), { key: 'End' });
    expect(radio('Tier 4')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Tier 4'), { key: 'ArrowDown' });
    expect(radio('Tier 1')).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(radio('Tier 1'), { key: 'ArrowLeft' });
    expect(radio('Tier 4')).toHaveFocus();
    fireEvent.keyDown(radio('Tier 4'), { key: 'Home' });
    expect(radio('Tier 1')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio('Tier 3'));
    expect(radio('Tier 3')).toHaveAttribute('aria-checked', 'true');
    expect(nextChoiceIndex('Tab', 0, 4)).toBeNull();
  });

  it('colours a tier chip by its tier, with the step mark, and marks the chosen one with a check as well as colour', () => {
    render(<Tiers />);
    const chosen = screen.getByRole('radio', { name: 'Tier 1' });
    const other = screen.getByRole('radio', { name: 'Tier 3' });
    expect(chosen).toHaveAttribute('data-tier', '1');
    expect(other).toHaveAttribute('data-tier', '3');
    expect(chosen.querySelector('.tier-step')).not.toBeNull();
    expect(chosen.querySelector('svg')).not.toBeNull();
    expect(other.querySelector('svg')).toBeNull();
    expect(chosen).toHaveClass('bg-tier-current-subtle', 'border-tier-current');
  });

  it('uses the control boundary for unchosen chips and the accent for a chosen chip that names no tier', () => {
    expect(choiceChipClass(false, true).split(' ')).toContain('border-input');
    expect(choiceChipClass(false, false).split(' ')).toContain('border-input');
    expect(choiceChipClass(true, false).split(' ')).toContain('border-primary');
    expect(choiceChipClass(true, false)).not.toMatch(/rounded-full/);
    render(<ChoiceChips label="Kind" options={[{ value: 'all', label: 'All' }, { value: 'term', label: 'Key terms' }]} value="all" onChange={() => {}} />);
    const all = screen.getByRole('radio', { name: 'All' });
    expect(all).not.toHaveAttribute('data-tier');
    expect(all.querySelector('.tier-step')).toBeNull();
  });
});
