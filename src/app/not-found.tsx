import type { Metadata } from "next";

import LearningLayout from "@/app/(learning)/layout";
import CurriculumNotFound from "@/components/curriculum/CurriculumNotFound";

/**
 * Root not-found page: URLs that match no route (for example a relative link
 * that escaped /curriculum) and notFound() calls outside the curriculum. The
 * root layout has no navigation, so this page wraps itself in the learning
 * layout (navbar, course outline, footer): no 404 is a dead end (G30-PAGE-04).
 */
/** Its own tab title, so the error page is not mistaken for the home page (WCAG 2.4.2). */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <LearningLayout>
      <CurriculumNotFound />
    </LearningLayout>
  );
}
