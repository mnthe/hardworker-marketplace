#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const SHEBANG = '#!/usr/bin/env node\n';
const distDir = path.join(__dirname, '..', 'dist');

function addShebang(dir) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      addShebang(filePath);
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.startsWith('#!')) {
        fs.writeFileSync(filePath, SHEBANG + content);
        fs.chmodSync(filePath, 0o755);
        console.log('Added shebang to:', filePath);
      }
    }
  });
}

addShebang(path.join(distDir, 'scripts'));
addShebang(path.join(distDir, 'hooks'));
console.log('Shebangs added successfully');
