const fs = require('fs');
const path = require('path');

const mappings = {
  uvm_config_db: '/curriculum/T2_Intermediate/I-UVM-3_Sequences/uvm-config-db',
  randc: '/curriculum/T2_Intermediate/I-SV-2_Constrained_Randomization',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const term of Object.keys(mappings)) {
    const link = mappings[term];
    const regex = new RegExp(`\\b${term}\\b`);
    if (regex.test(content)) {
      content = content.replace(regex, `<Link href="${link}">${term}</Link>`);
      break;
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.mdx')) processFile(p);
  }
}

walk(path.join(process.cwd(), 'content', 'curriculum'));
