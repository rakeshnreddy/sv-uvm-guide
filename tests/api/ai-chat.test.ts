import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../src/app/api/ai/chat/route';
import { NextRequest } from 'next/server';

// Mock the Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  const generateContentSpy = vi.fn().mockResolvedValue({
    response: {
      text: () => "Mocked AI Response",
    },
  });

  const getGenerativeModelSpy = vi.fn().mockReturnValue({
    generateContent: generateContentSpy,
  });

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: getGenerativeModelSpy,
    })),
    // Export spies for verification
    _generateContentSpy: generateContentSpy,
    _getGenerativeModelSpy: getGenerativeModelSpy,
  };
});

describe('AI Chat API Route', () => {
  const GEMINI_API_KEY = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = GEMINI_API_KEY;
  });

  it('should use systemInstruction and structured parts', async () => {
    const systemPrompt = "You are a SV expert.";
    const userQuestion = "What is a uvm_component?";
    const pageContext = "Chapter 1: Introduction";

    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        systemPrompt,
        userQuestion,
        pageContext,
      }),
    });

    await POST(req);

    const { GoogleGenerativeAI, _getGenerativeModelSpy, _generateContentSpy } = await import('@google/generative-ai');

    // Verify model initialization
    expect(_getGenerativeModelSpy).toHaveBeenCalledWith({
      model: "gemini-pro",
      systemInstruction: systemPrompt,
    });

    // Verify content generation parts
    const promptParts = _generateContentSpy.mock.calls[0][0];
    expect(promptParts).toContain(`CONTEXT:\nChapter 1: Introduction\n\n`);
    expect(promptParts).toContain(`USER QUESTION:\nWhat is a uvm_component?`);
  });

  it('should sanitize user input', async () => {
    const userQuestion = 'Tell me about "UVM"';

    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        userQuestion,
      }),
    });

    await POST(req);

    const { _generateContentSpy } = await import('@google/generative-ai');
    const promptParts = _generateContentSpy.mock.calls[0][0];

    // Check that quotes are escaped in the prompt parts
    expect(promptParts[promptParts.length - 1]).toContain('Tell me about \\"UVM\\"');
  });

  it('should return 400 if userQuestion is missing', async () => {
    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("User question is missing.");
  });

  it('should return 500 if API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ userQuestion: "Hi" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("AI service is not configured.");
  });
});
