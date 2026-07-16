const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const files = ['index.js', 'commands.js', 'api.js', 'settings.js'];
const allowedHosts = new Set(['cod3uchiha.com', 'www.cod3uchiha.com']);
const forbiddenBranding = /knight[\s_-]*bot|\bknight\b/i;
const violations = [];

for (const filename of files) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');

  if (forbiddenBranding.test(source)) {
    violations.push(`${filename}: old branding found`);
  }

  for (const raw of source.match(/https?:\/\/[^\s"'`<>\\)]+/g) || []) {
    const cleaned = raw.replace(/[.,;]+$/, '');
    let url;
    try {
      url = new URL(cleaned);
    } catch {
      continue;
    }

    if (!allowedHosts.has(url.hostname)) {
      violations.push(`${filename}: disallowed external URL ${cleaned}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('PASS: T branding only and all external API URLs use cod3uchiha.com.');
