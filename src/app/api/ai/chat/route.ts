import { NextRequest, NextResponse } from 'next/server';

// This would typically come from a .env.local file
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// The actual Gemini API endpoint or SDK import would go here.
// For example, if using Google's Generative AI SDK:
// import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY) {
    console.error("Gemini API key is not configured.");
    return NextResponse.json(
      { error: "AI service is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { systemPrompt, pageContext, userQuestion } = body;

    if (!userQuestion) {
      return NextResponse.json(
        { error: "User question is missing." },
        { status: 400 }
      );
    }

    // Construct the full prompt for Gemini
    let fullPrompt = `${systemPrompt}\n\n`;
    if (pageContext) {
      fullPrompt += `CONTEXT:\n${pageContext}\n\n`;
    }
    fullPrompt += `USER QUESTION:\n${userQuestion}`;

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent(fullPrompt);
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
