type GraderResult = {
  success: boolean;
  hint?: string;
};

type StepGrader = (code: string) => GraderResult;

export const LAB_GRADERS: Record<string, Record<string, StepGrader>> = {
  "basics-1": {
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
