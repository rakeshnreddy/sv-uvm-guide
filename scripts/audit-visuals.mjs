import fs from 'fs';
import path from 'path';

const searchDirs = ['src/app', 'content/curriculum', 'content/labs', 'src/components'];
const componentDirs = ['src/components/diagrams', 'src/components/visuals'];

const getAllFiles = (dir, ext) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(getAllFiles(file, ext));
        } else { 
            if (file.endsWith(ext) || file.endsWith('.mdx')) results.push(file);
        }
    });
    return results;
};

const components = [];
componentDirs.forEach(d => {
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).filter(f => f.endsWith('.tsx')).forEach(file => {
        components.push({ name: file.replace('.tsx', ''), path: d + '/' + file });
    });
});

const usageFiles = [];
searchDirs.forEach(d => {
    if (!fs.existsSync(d)) return;
    usageFiles.push(...getAllFiles(d, '.tsx'));
});

const unused = [];
components.forEach(comp => {
    let used = false;
    for (const file of usageFiles) {
        if (file === comp.path) continue; // Don't count itself
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(comp.name)) {
            used = true;
            break;
        }
    }
    if (!used) unused.push(comp);
});

console.log("Unused visual assets:");
unused.forEach(comp => console.log(comp.path));
