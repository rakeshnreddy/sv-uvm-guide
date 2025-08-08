import { describe, it, expect } from 'vitest';
import { generateCurriculumData } from '../scripts/generate-curriculum-data';

describe('curriculum generator', () => {
  it('generates expected curriculum data', () => {
    const data = generateCurriculumData();
    expect(data).toMatchSnapshot();
  });
});

