import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  const { content } = await request.json();

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Provide feedback on the following explanation using the Feynman technique. Score it out of 100 and provide constructive feedback on how to improve it.\n\nExplanation: "${content}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Assuming the AI returns a response in the format "Score: XX\n\nFeedback: ..."
    const scoreMatch = text.match(/Score: (\d+)/);
    const feedbackMatch = text.match(/Feedback: ([\s\S]*)/);

    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : "Could not parse feedback.";

    return NextResponse.json({ score, feedback });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return NextResponse.json({ error: 'Failed to get feedback from AI' }, { status: 500 });
  }
}
