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
    if (content.includes("import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';\n// @ts-nocheck\n'use client';")) {
        content = content.replace("import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';\n// @ts-nocheck\n'use client';", "'use client';\n// @ts-nocheck\nimport { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';");
        fs.writeFileSync(file, content, 'utf-8');
        console.log('Fixed', file);
    } else if (content.includes("import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';\n'use client';")) {
        content = content.replace("import { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';\n'use client';", "'use client';\nimport { WebGLFallbackBoundary } from '@/components/ui/WebGLFallbackBoundary';");
        fs.writeFileSync(file, content, 'utf-8');
        console.log('Fixed', file);
    } else {
        // Fallback robust replacement if there's other stuff like docstrings
        const lines = content.split('\n');
        const fallbackIdx = lines.findIndex(l => l.includes('WebGLFallbackBoundary'));
        const useClientIdx = lines.findIndex(l => l.includes("'use client'"));
        if (useClientIdx > fallbackIdx) {
            // Swap them
            const u = lines.splice(useClientIdx, 1)[0];
            lines.unshift(u);
            fs.writeFileSync(file, lines.join('\n'), 'utf-8');
            console.log('Fixed via robust swap', file);
        }
    }
}
