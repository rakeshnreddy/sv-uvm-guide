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
    const cardId = card.id || `${path.basename(file, '.json')}-${idx}`;
    const question = card.question || card.front;
    const answer = card.answer || card.back;

    if (!question || !answer) {
      console.error(`${file} card at index ${idx} has empty fields`);
      hasError = true;
    }
    if (ids.has(cardId)) {
      console.error(`${file} has duplicate id ${cardId}`);
      hasError = true;
    }
    if (globalIds.has(cardId)) {
      console.error(`Duplicate id across files: ${cardId} in ${file}`);
      hasError = true;
    }
    ids.add(cardId);
    globalIds.add(cardId);
  });
}

if (hasError) {
  process.exit(1);
} else {
  console.log('All flashcard files are valid');
}
