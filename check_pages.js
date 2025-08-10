require('ts-node/register');

const { execSync } = require('child_process');
const { curriculumData } = require('./src/lib/curriculum-data.tsx');

for (const courseModule of curriculumData) {
  for (const section of courseModule.sections) {
    for (const topic of section.topics) {
      const url = `http://localhost:3000/curriculum/${courseModule.slug}/${section.slug}/${topic.slug}`;
      try {
        const stdout = execSync(`curl -I ${url}`);
        console.log(`Checked ${url}:\n${stdout}`);
      } catch (error) {
        console.error(`Error checking ${url}: ${error.message}`);
      }
    }
  }
}

