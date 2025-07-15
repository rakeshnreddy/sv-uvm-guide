import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

// Mock the CopyButton component
vi.mock('./CopyButton', () => ({
  CopyButton: ({ textToCopy }: { textToCopy: string }) => (
    <button onClick={() => navigator.clipboard.writeText(textToCopy)}>
      Copy
    </button>
  ),
}));

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});

vi.mock('rehype', () => ({
  rehype: vi.fn().mockReturnValue({
    data: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    process: vi.fn().mockImplementation((code) => Promise.resolve({ toString: () => `<code>${code}</code>` })),
  }),
}));

describe('CodeBlock', () => {
  const code = 'console.log("Hello, World!");';
  const language = 'javascript';

  it('renders the code snippet', async () => {
    render(<CodeBlock code={code} language={language} />);
    const codeElement = await screen.findByText(/console.log/);
    expect(codeElement).toBeInTheDocument();
  });

  it('copies the code to the clipboard when the copy button is clicked', async () => {
    render(<CodeBlock code={code} language={language} />);
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await userEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code);
  });
});
