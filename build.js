/*-----NETLIFY-----/*
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

console.log('SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'VACÍA');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'OK (tiene valor)' : 'VACÍA');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_ANON_KEY');
  process.exit(1);
}

const EXCLUDE = ['dist', 'node_modules', '.git', 'build.js', 'netlify.toml', 'supabase_schema.sql', 'INSTALACION.md', '.gitignore'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });
copyDir('.', 'dist');

const configPath = path.join('dist', 'js', 'config.js');
const config = `const SUPABASE_URL = '${SUPABASE_URL}';\nconst SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';\n`;
fs.writeFileSync(configPath, config);

console.log('Build completado.');*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Vercel expone las env vars — intentar leerlas de múltiples formas
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.supabase_anon_key || '';

console.log('SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'VACÍA');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'OK' : 'VACÍA');
console.log('Todas las env vars:', Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('supa')));

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('ERROR: Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_ANON_KEY');
  process.exit(1);
}

const EXCLUDE = ['dist', 'node_modules', '.git', 'build.js', 'vercel.json', 'netlify.toml', 'supabase_schema.sql', 'INSTALACION.md', '.gitignore'];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDE.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

if (fs.existsSync('dist')) fs.rmSync('dist', { recursive: true });
copyDir('.', 'dist');

const configPath = path.join('dist', 'js', 'config.js');
const config = `const SUPABASE_URL = '${SUPABASE_URL}';\nconst SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';\n`;
fs.writeFileSync(configPath, config);

console.log('Build completado.');