import { registerSystemVerilogLanguage } from '@/components/ui/InteractiveCode';
import { describe, it, expect, vi } from 'vitest';

describe('SystemVerilog language registration', () => {
  it('registers the language with correctly configured Monarch rules', () => {
    let registeredLanguageId = '';
    let languageDef: any = null;

    const mockMonaco = {
      languages: {
        register: (def: any) => {
          registeredLanguageId = def.id;
        },
        getLanguages: () => [],
        setLanguageConfiguration: vi.fn(),
        setMonarchTokensProvider: (id: string, def: any) => {
          languageDef = def;
        }
      }
    };

    registerSystemVerilogLanguage(mockMonaco as any);

    expect(registeredLanguageId).toBe('systemverilog');
    expect(languageDef).toBeDefined();

    // Verify it contains keywords
    expect(languageDef.keywords).toContain('module');
    expect(languageDef.keywords).toContain('class');

    // Verify it contains a token postfix
    expect(languageDef.tokenPostfix).toBe('.sv');

    // Verify it defines a default token
    expect(languageDef.defaultToken).toBe('');
  });
});
