const fs = require('fs');
const path = require('path');

const sourceDir = __dirname;
const destDir = path.join(__dirname, 'THE REPO');

const ignorePatterns = [
  'node_modules',
  'dist',
  'dist-ssr',
  'dist-electron',
  'release',
  'build',
  '.vscode',
  '.idea',
  '.git',
  'THE REPO',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'dev.db',
  'dev.db-journal',
  '.env',
  'eb-log.txt',
  'test-absolute.db',
  'test-no-exist.db',
  'test-prisma.ts',
  'test-prisma-create.ts',
  'copy-to-repo.js'
];

function shouldIgnore(name, fullPath) {
  if (ignorePatterns.includes(name)) return true;
  if (name.endsWith('.log')) return true;
  if (name.endsWith('.db')) return true;
  return false;
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItemName => {
      const srcChild = path.join(src, childItemName);
      if (!shouldIgnore(childItemName, srcChild)) {
        copyRecursiveSync(srcChild, path.join(dest, childItemName));
      }
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

copyRecursiveSync(sourceDir, destDir);
console.log('Copy completed successfully to THE REPO folder.');
