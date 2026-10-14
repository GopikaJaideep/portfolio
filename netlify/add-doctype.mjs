// Netlify build step: copies only the public site into dist/ (pages, assets, media), leaving out
// notes, configs and the old single-page backups, and adds <!doctype html> to index.html.
// index.html is written without a doctype so it also works as a claude.ai artifact (which adds its own
// wrapper); on Netlify it needs one, or browsers render the home page in quirks mode.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'dist';
const PAGES = ['index.html', 'experience.html', 'education.html', 'projects.html', 'skills.html', 'evals.html', 'agent.html', 'about.html'];
const MEDIA = ['character.mp4', 'poster.jpg', 'gopika.jpg'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of [...PAGES, ...MEDIA]) fs.copyFileSync(f, path.join(OUT, f));
fs.cpSync('assets', path.join(OUT, 'assets'), { recursive: true, filter: src => !src.endsWith('mascot.png') });

const index = path.join(OUT, 'index.html');
const html = fs.readFileSync(index, 'utf8');
if (!/^\s*<!doctype html>/i.test(html)) fs.writeFileSync(index, '<!doctype html>\n<html lang="en">\n' + html + '\n</html>\n');
console.log(`build: ${PAGES.length} pages + assets copied to ${OUT}/`);
