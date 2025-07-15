"use client";

import { AnimatePresence } from 'framer-motion';

// Re-exporting AnimatePresence from a client component can sometimes help
// with "export *" issues in Next.js App Router when framer-motion is used
// in server components or mixed environments.

export { AnimatePresence };

// You could also create a more specific provider if needed, e.g.,
// interface MotionProviderProps {
//   children: React.ReactNode;
//   mode?: "wait" | "sync" | "popLayout";
// }
// export const MotionProvider: React.FC<MotionProviderProps> = ({ children, mode = "wait" }) => {
//   return <AnimatePresence mode={mode}>{children}</AnimatePresence>;
// };
