const fs = require('fs');
const path = require('path');

// Every card needs an explicit, stable id that is unique across all decks:
// learners' review state (src/lib/srs/review-store.ts) is keyed by card id, so
// an index-based id would move a learner's history onto another card as soon
// as a card is inserted or reordered.

const dir = path.join(__dirname, '..', 'content', 'flashcards');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const globalIds = new Map();
let hasError = false;

for (const file of files) {
  const filePath = path.join(dir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`${file} is not valid JSON: ${error.message}`);
    hasError = true;
    continue;
  }
  if (!Array.isArray(data)) {
    console.error(`${file} must hold an array of cards`);
    hasError = true;
    continue;
  }
  const ids = new Set();
  data.forEach((card, idx) => {
    const cardId = card && typeof card.id === 'string' ? card.id.trim() : '';
    const question = card && (card.question || card.front);
    const answer = card && (card.answer || card.back);

    if (!question || !answer) {
      console.error(`${file} card at index ${idx} has empty fields`);
      hasError = true;
    }
    if (!cardId) {
      console.error(`${file} card at index ${idx} has no explicit id (add a stable "id", for example "${path.basename(file, '.json').toLowerCase()}-${idx + 1}")`);
      hasError = true;
      return;
    }
    if (cardId !== card.id) {
      console.error(`${file} card at index ${idx} has an id with leading or trailing spaces: "${card.id}"`);
      hasError = true;
    }
    if (ids.has(cardId)) {
      console.error(`${file} has duplicate id ${cardId}`);
      hasError = true;
    } else if (globalIds.has(cardId)) {
      console.error(`Duplicate id across files: ${cardId} in ${file} and ${globalIds.get(cardId)}`);
      hasError = true;
    }
    ids.add(cardId);
    if (!globalIds.has(cardId)) globalIds.set(cardId, file);
  });
}

if (hasError) {
  process.exit(1);
} else {
  console.log('All flashcard files are valid');
}
