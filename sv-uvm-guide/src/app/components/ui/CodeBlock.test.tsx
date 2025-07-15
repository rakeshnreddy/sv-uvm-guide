import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CodeBlock from './CodeBlock';

// Mock the CopyButton component
vi.mock('./CopyButton', () => ({
  __esModule: true,
  default: ({ textToCopy }: { textToCopy: string }) => (
    <button
      onClick={() => navigator.clipboard.writeText(textToCopy)}
    >
      Copy
    </button>
  ),
}));

describe('CodeBlock', () => {
  const code = `module test;
  initial begin
    $display("Hello, World!");
  end
endmodule`;

  it('renders the code', () => {
    render(<CodeBlock code={code} language="systemverilog" />);
    expect(screen.getByText('Hello, World!')).toBeInTheDocument();
  });

  it('calls clipboard.writeText when the copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(<CodeBlock code={code} language="systemverilog" />);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledWith(code);
  });
});
