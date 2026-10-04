import CurriculumNotFound from "@/components/curriculum/CurriculumNotFound";

/**
 * notFound() from a curriculum URL that resolves to no lesson
 * (/curriculum/does-not-exist, a missing lesson in a real module). Rendered
 * inside the learning layout, so the navbar and footer stay.
 */
export default function CurriculumRouteNotFound() {
  return <CurriculumNotFound />;
}
