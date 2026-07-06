const fs = require('fs');
const path = require('path');

const routesDir = 'backend/src/routes';

// Files already processed (single-line try-catch done)
const doneFiles = new Set([
  'department.routes.ts', 'group-buy.routes.ts', 'marketing-asset.routes.ts',
  'points-mall.routes.ts', 'seckill.routes.ts', 'user-session.routes.ts',
]);

// Files to skip (legitimate try-catch in helpers/middleware)
const skipFiles = new Set([
  'order-timeout.routes.ts', 'wechat.routes.ts', 'share.routes.ts',
  'store-control.routes.ts', 'inventory-batch.routes.ts',
]);

function processFile(filePath) {
  const fileName = path.basename(filePath);
  if (doneFiles.has(fileName) || skipFiles.has(fileName)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Remove try { lines
  content = content.replace(/^\s*try\s*\{\s*$/gm, '');

  // Pattern 1: multi-line catch with { code: ..., message: ... }
  // } catch (e: any) { \n    res.status(e.statusCode || 400).json({ code: String(e.statusCode || 400), message: e.message });\n  }
  content = content.replace(
    /\}\s*catch\s*\(\s*e\s*:\s*any\s*\)\s*\{\s*\n\s*res\.status\(\s*e\.statusCode\s*\|\|\s*\d+\s*\)\.json\(\s*\{\s*code:\s*String\(\s*e\.statusCode\s*\|\|\s*\d+\s*\)\s*,\s*message:\s*e\.message\s*\}\s*\)\s*;\s*\n\s*\}/g,
    ''
  );

  // Pattern 2: multi-line catch with fail() (platform, platform-tenant)
  // } catch (err: any) { \n    res.status(500).json(fail((err as any).message || "..."));\n  }
  content = content.replace(
    /\}\s*catch\s*\(\s*err\s*:\s*any\s*\)\s*\{\s*\n\s*res\.status\(\s*\d+\s*\)\.json\(\s*fail\([^)]*\)\s*\)\s*;\s*\n\s*\}/g,
    ''
  );

  // Pattern 3: multi-line catch with fail() (purchase with 400)
  // } catch (e: any) { \n    res.status(400).json(fail(e.message, "400"));\n  }
  // Already covered by Pattern 1 generally, but this is a specific variant
  content = content.replace(
    /\}\s*catch\s*\(\s*e\s*:\s*any\s*\)\s*\{\s*\n\s*res\.status\(\s*\d+\s*\)\.json\(\s*fail\(\s*e\.message\s*,\s*"[^"]*"\s*\)\s*\)\s*;\s*\n\s*\}/g,
    ''
  );

  if (content === original) return false;

  // Replace res.status().json(fail()) with throw AppError
  let hasAppError = false;
  content = content.replace(
    /res\.status\((\d+)\)\.json\(fail\(("[^"]*"[^)]*)\)\)\s*;?\s*/g,
    (_, statusCode, failArgs) => {
      hasAppError = true;
      return `throw new AppError(${failArgs}, ${statusCode});`;
    }
  );
  content = content.replace(
    /res\.status\((\d+)\)\.json\(fail\(("[^"]*"[^)]*)\)\)\s*;\s*return\s*;?\s*/g,
    (_, statusCode, failArgs) => {
      hasAppError = true;
      return `throw new AppError(${failArgs}, ${statusCode});`;
    }
  );

  // Add AppError import
  if (hasAppError && !content.includes('from "../shared/app-error.js"')) {
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, 'import { AppError } from "../shared/app-error.js";');
      content = lines.join('\n');
    }
  }

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
    // Fix closing: }); → })); at end of line
    content = content.replace(/}\s*\)\s*;\s*$/gm, '}));');
  }

  // Remove unused fail import
  if (!content.includes('fail(')) {
    content = content.replace(/import\s*\{\s*ok\s*,\s*fail\s*\}\s*from\s*"[^"]*";\n?/g, 'import { ok } from "../shared/response.js";\n');
    content = content.replace(/import\s*\{\s*fail\s*,\s*ok\s*\}\s*from\s*"[^"]*";\n?/g, 'import { ok } from "../shared/response.js";\n');
  }

  // Remove unused Request/Response type imports
  const reqUsed = content.includes(': Request') || content.includes('<Request');
  const resUsed = content.includes(': Response') || content.includes('<Response');
  if (!reqUsed && !resUsed) {
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