import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { registerSystemVerilogLanguage } from '@/components/ui/InteractiveCode';

// jsdom does not implement matchMedia which Monaco expects.
// Provide a minimal stub for the tests.
beforeAll(() => {
  if (!window.matchMedia) {
    // @ts-ignore
    window.matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
});

describe('SystemVerilog language registration', () => {
  it('tokenizes modules, classes and comments', () => {
    registerSystemVerilogLanguage(monaco);

    const code = `// A simple module\nmodule m;\n  class C;\n  endclass\nendmodule`;
    const tokens = monaco.editor.tokenize(code, 'systemverilog');

    // first line should be a comment
    expect(tokens[0][0].type).toContain('comment');

    // second line should contain a module keyword
    expect(tokens[1].some(t => t.type.includes('keyword'))).toBe(true);

    // third line should contain a class keyword
    expect(tokens[2].some(t => t.type.includes('keyword'))).toBe(true);
  });
});
