import { NextRequest, NextResponse } from 'next/server';
import { validateAIInput } from '@/lib/ai-validation';
// The actual Gemini API endpoint or SDK import would go here.
// For example, if using Google's Generative AI SDK:
// import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const body = await req.json();
    const { systemPrompt, pageContext, userQuestion } = body;

    if (!userQuestion) {
      return NextResponse.json(
        { error: "User question is missing." },
        { status: 400 }
      );
    }

    if (!geminiApiKey) {
      console.error("Gemini API key is not configured.");
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    // Validate and sanitize user inputs
    const sanitizedUserQuestion = validateAIInput(userQuestion);
    const sanitizedPageContext = pageContext ? validateAIInput(pageContext) : "";

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Use systemInstruction to properly isolate the system prompt from user input
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: systemPrompt || "You are a helpful assistant for SystemVerilog and UVM verification engineers."
    });

    // Use structured content parts instead of simple string interpolation
    const promptParts = [];
    if (sanitizedPageContext) {
      promptParts.push(`CONTEXT:\n${sanitizedPageContext}\n\n`);
    }
    promptParts.push(`USER QUESTION:\n${sanitizedUserQuestion}`);

    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      reply: text,
    });

  } catch (error) {
    console.error('Error processing AI chat request:', error);
    let errorMessage = "An unexpected error occurred.";
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json(
      { error: "Failed to get AI response.", details: errorMessage },
      { status: 500 }
    );
  }
}

// Optional: GET handler for testing or other purposes
export async function GET() {
  return NextResponse.json({ message: "AI Chat API is active. Use POST to send messages." });
}
