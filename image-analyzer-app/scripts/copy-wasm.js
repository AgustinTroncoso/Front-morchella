const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'node_modules', '@tensorflow', 'tfjs-tflite', 'wasm');
const destDir = path.resolve(__dirname, '..', 'public', 'tflite');
const destRoot = path.resolve(__dirname, '..', 'public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log('Copied', srcPath, '->', destPath);
      // También copiar al public raiz para cubrir requests que no usan subruta
      try {
        const destRootPath = path.join(destRoot, entry.name);
        fs.copyFileSync(srcPath, destRootPath);
        console.log('Also copied', srcPath, '->', destRootPath);
      } catch (e) {
        // ignorar
      }
    }
  }
}

try {
  if (!fs.existsSync(srcDir)) {
    console.error('Source wasm folder not found:', srcDir);
    process.exit(0);
  }
  copyRecursive(srcDir, destDir);
  console.log('WASM files copied to', destDir);
} catch (err) {
  console.error('Failed to copy wasm files:', err);
  process.exit(1);
}
