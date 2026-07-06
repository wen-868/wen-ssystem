const fs = require('fs');
const path = require('path');

const routesDir = 'backend/src/routes';

const skipFiles = new Set([
  'order-timeout.routes.ts', 'wechat.routes.ts', 'share.routes.ts',
  'store-control.routes.ts', 'inventory-batch.routes.ts',
]);

function processFile(filePath) {
  const fileName = path.basename(filePath);
  if (skipFiles.has(fileName)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Pattern 1: Single-line try-catch
  const p1 = /try\s*\{\s*(.*?)\s*\}\s*catch\s*\(\s*e\s*:\s*any\s*\)\s*\{\s*res\.status\(\s*\d+\s*\)\.json\(\s*fail\(\s*e\.message\s*,\s*"[^"]*"\s*\)\s*\)\s*;\s*\}/g;
  content = content.replace(p1, (_, body) => body.trim());

  if (content === original) return false;

  // Add asyncHandler import if not present
  if (!content.includes('asyncHandler')) {
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, 'import { asyncHandler } from "../middleware/async-handler.js";');
      content = lines.join('\n');
    }
  }

  // Replace async (req: Request, res: Response) => { with asyncHandler(async (req, res) => {
  if (content.includes('asyncHandler')) {
    content = content.replace(
      /async\s*\(\s*req\s*:\s*Request\s*,\s*res\s*:\s*Response\s*\)\s*=>\s*\{/g,
      'asyncHandler(async (req, res) => {'
    );

    // Fix: add ) to close asyncHandler before }); at END OF LINE
    // Pattern: }); at end of line → }));
    content = content.replace(/}\s*\)\s*;\s*$/gm, '}));');
  }

  // Remove unused fail import
  if (!content.includes('fail(')) {
    content = content.replace(/import\s*\{\s*ok\s*,\s*fail\s*\}\s*from\s*"[^"]*";\n?/g, 'import { ok } from "../shared/response.js";\n');
    content = content.replace(/import\s*\{\s*fail\s*,\s*ok\s*\}\s*from\s*"[^"]*";\n?/g, 'import { ok } from "../shared/response.js";\n');
  }

  // Remove unused Request/Response type imports
  if (!content.includes(': Request') && !content.includes('<Request') &&
      !content.includes(': Response') && !content.includes('<Response')) {
    content = content.replace(/import\s*type\s*\{\s*Request\s*,\s*Response\s*\}\s*from\s*"express";\n?/g, '');
    content = content.replace(/import\s*type\s*\{\s*Response\s*,\s*Request\s*\}\s*from\s*"express";\n?/g, '');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${filePath}`);
  return true;
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));
let count = 0;
for (const file of files) {
  if (processFile(path.join(routesDir, file))) count++;
}
console.log(`\nProcessed ${count} route files.`);