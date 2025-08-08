import { describe, it, expect } from 'vitest';
import { generateCurriculumData } from '../scripts/generate-curriculum-data';
import { curriculumData } from '../src/lib/curriculum-data';

describe('curriculum generator', () => {
  it('generates expected curriculum data', () => {
    const data = generateCurriculumData();
    expect(data).toMatchSnapshot();
  });

  it('generated file matches snapshot', () => {
    expect(curriculumData).toMatchSnapshot();
  });

  it('file is in sync with generator', () => {
    const data = generateCurriculumData();
    expect(curriculumData).toEqual(data);
  });
});

