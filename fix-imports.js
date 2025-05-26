const fs = require('fs');
const path = require('path');

const fixes = [
  // Fix config imports
  {
    pattern: /import \{ config \} from/g,
    replacement: 'import { getConfig } from'
  },
  {
    pattern: /config\./g,
    replacement: 'getConfig().'
  },
  
  // Fix error class names
  {
    pattern: /SchemaParsingError/g,
    replacement: 'SchemaParseError'
  },
  {
    pattern: /ProviderNotFoundError/g,
    replacement: 'ProviderNotSupportedError'
  },
  
  // Add null checks for regex matches
  {
    pattern: /const (\w+) = match\[(\d+)\]/g,
    replacement: 'const $1 = match?.[$2]'
  }
];

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  fixes.forEach(fix => {
    if (fix.pattern.test(content)) {
      content = content.replace(fix.pattern, fix.replacement);
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Find all TypeScript files
function findTsFiles(dir) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
        scan(fullPath);
      } else if (item.endsWith('.ts')) {
        files.push(fullPath);
      }
    });
  }
  
  scan(dir);
  return files;
}

// Fix all files
const srcDir = path.join(__dirname, 'src');
const tsFiles = findTsFiles(srcDir);

tsFiles.forEach(fixFile);

console.log('All files processed!');