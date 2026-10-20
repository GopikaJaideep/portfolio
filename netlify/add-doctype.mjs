// Netlify build step: copies only the public site into dist/ (pages, assets, media), leaving out
// notes, configs and the old single-page backups, and adds <!doctype html> to index.html.
// index.html is written without a doctype so it also works as a claude.ai artifact (which adds its own
// wrapper); on Netlify it needs one, or browsers render the home page in quirks mode.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUT = 'dist';
const PAGES = ['index.html', 'experience.html', 'education.html', 'projects.html', 'skills.html', 'evals.html', 'agent.html', 'about.html'];
const MEDIA = ['character.mp4', 'poster.jpg', 'gopika.jpg', 'googled4348b6ca194e413.html'];   // last one: Google Search Console verification, served as-is

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const f of [...PAGES, ...MEDIA]) fs.copyFileSync(f, path.join(OUT, f));
fs.cpSync('assets', path.join(OUT, 'assets'), { recursive: true, filter: src => !src.endsWith('mascot.png') });

const index = path.join(OUT, 'index.html');
const html = fs.readFileSync(index, 'utf8');
if (!/^\s*<!doctype html>/i.test(html)) fs.writeFileSync(index, '<!doctype html>\n<html lang="en">\n' + html + '\n</html>\n');
// sitemap + robots.txt for search engines; each page's <lastmod> is the date of its last commit
const SITE = 'https://gopika-jaideep.netlify.app';
const today = new Date().toISOString().slice(0, 10);
const lastmod = f => {
  try { return execSync(`git log -1 --format=%cs -- "${f}"`, { encoding: 'utf8' }).trim() || today; } catch { return today; }
};
const urls = PAGES.map(f => `  <url>\n    <loc>${SITE}/${f === 'index.html' ? '' : f}</loc>\n    <lastmod>${lastmod(f)}</lastmod>\n    <priority>${f === 'index.html' ? '1.0' : '0.8'}</priority>\n  </url>`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`build: ${PAGES.length} pages + assets copied to ${OUT}/, sitemap.xml and robots.txt written`);
