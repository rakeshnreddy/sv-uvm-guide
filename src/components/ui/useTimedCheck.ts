import React from "react";

export type CheckResult = {
  status: "pending" | "pass" | "fail";
  details?: string;
};

export const useTimedCheck = (delay: number, details: string): CheckResult => {
  const [result, setResult] = React.useState<CheckResult>({ status: "pending" });
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setResult({ status: "pass", details });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, details]);
  return result;
};

export default useTimedCheck;
