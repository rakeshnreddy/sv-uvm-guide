// vitest.setup.ts
import '@testing-library/jest-dom';
// You can add other global setup here if needed, for example:
// - Mocking global objects (like navigator.clipboard for CodeBlock tests)
// - Setting up global mocks for libraries (like framer-motion for Button tests)

// Example: Mock framer-motion globally if many components use it and you want to simplify tests
// vi.mock('framer-motion', async (importOriginal) => {
//   const actual = await importOriginal();
//   return {
//     ...actual,
//     motion: {
//       ...actual.motion,
//       // Replace motion components with simple divs or functional components
//       // This is a basic example; you might need more sophisticated mocks
//       button: (props: any) => <button {...props} />,
//       div: (props: any) => <div {...props} />,
//       // Add other motion elements you use
//     },
//     AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
//   };
// });
