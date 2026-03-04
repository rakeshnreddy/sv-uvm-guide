const fs = require('fs');
const files = [
    'src/components/curriculum/interactives/3d/Constraint3D.tsx',
    'src/components/curriculum/interactives/3d/PhaseTimeline3D.tsx',
    'src/components/curriculum/interactives/3d/Mailbox3D.tsx',
    'src/components/curriculum/interactives/3d/Dataflow3D.tsx',
    'src/components/curriculum/interactives/3d/Coverage3D.tsx',
    'src/components/curriculum/interactives/3d/Analysis3D.tsx',
    'src/components/curriculum/f2/SystemVerilog3DVisualizer.tsx'
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf-8');
    if (!content.includes('WebGLFallbackBoundary')) {
        content = `import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';\n` + content;
        content = content.replace(/<Canvas([^>]*)>/g, '<WebGLFallbackBoundary><Canvas$1>');
        content = content.replace(/<\/Canvas>/g, '</Canvas></WebGLFallbackBoundary>');
        fs.writeFileSync(file, content, 'utf-8');
        console.log('Fixed', file);
    }
}
