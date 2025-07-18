import { NextResponse } from 'next/server';

const labs: any = {
  "1": {
    "1": (code: string) => {
      const success = /int\s+myVar;/.test(code);
      return {
        success,
        hint: success ? "Correct!" : "Hint: Make sure you declare a variable named 'myVar' of type 'int'.",
      };
    },
    "2": (code: string) => {
      const success = /myVar\s*=\s*10;/.test(code);
      return {
        success,
        hint: success ? "Correct!" : "Hint: Make sure you assign the value 10 to the variable 'myVar'.",
      };
    },
  },
};

export async function POST(request: Request) {
  const { code, labId, stepId } = await request.json();

  if (!labs[labId] || !labs[labId][stepId]) {
    return NextResponse.json({ error: "Lab or step not found" }, { status: 404 });
  }

  const result = labs[labId][stepId](code);
  return NextResponse.json(result);
}
