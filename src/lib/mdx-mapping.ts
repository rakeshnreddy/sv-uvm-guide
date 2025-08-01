import { curriculumData } from './curriculum-data';

export const mdxMapping: { [key: string]: string } = {};

for (const tier of curriculumData) {
  for (const section of tier.sections) {
    for (const topic of section.topics) {
      const path = `/curriculum/${tier.slug}/${section.slug}/${topic.slug}`;
      const filePath =
        `/content/curriculum/${tier.slug}/${section.slug}/${topic.slug}.mdx`;
      mdxMapping[path] = filePath;
    }
  }
}
