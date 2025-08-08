const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content', 'flashcards');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const globalIds = new Set();
let hasError = false;

for (const file of files) {
  const filePath = path.join(dir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const ids = new Set();
  data.forEach((card, idx) => {
    if (!card.id || !card.question || !card.answer) {
      console.error(`${file} card at index ${idx} has empty fields`);
      hasError = true;
    }
    if (ids.has(card.id)) {
      console.error(`${file} has duplicate id ${card.id}`);
      hasError = true;
    }
    if (globalIds.has(card.id)) {
      console.error(`Duplicate id across files: ${card.id} in ${file}`);
      hasError = true;
    }
    ids.add(card.id);
    globalIds.add(card.id);
  });
}

if (hasError) {
  process.exit(1);
} else {
  console.log('All flashcard files are valid');
}
