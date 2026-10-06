import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const legalDocuments = JSON.parse(await readFile(new URL('../src/legal/legalDocuments.json', import.meta.url), 'utf8'));

// Published bytes are immutable. Change the version when changing a published document.
const version = '2026-10-06.1';
const directory = new URL(`../public/legal/${version}/`, import.meta.url);
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function article(document) {
  return `<article><h1>${escape(document.title)}</h1>${document.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}${section.rows.length ? `<div class="table"><table><thead><tr>${section.rows[0].map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${section.rows.slice(1).map(row => `<tr>${row.map((c, i) => i ? `<td>${escape(c)}</td>` : `<th scope="row">${escape(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</section>`).join('')}</article>`;
}
const manifest = [];
await mkdir(directory, { recursive: true });
for (const [type, filename, documents] of [
  ['TERMS', 'terms', [legalDocuments.terms]],
  ['PRIVACY', 'privacy', [legalDocuments.signupPrivacy, legalDocuments.privacy]],
  ['CONTACT_SHARING', 'contact-sharing', [legalDocuments.contactSharing]],
]) {
  const html = `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(documents[0].title)} · PICO</title><style>body{max-width:880px;margin:0 auto;padding:24px 20px;color:#202632;font:16px/1.8 system-ui,sans-serif;word-break:keep-all;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:16px;font-size:14px}a{color:#5144bd}h1{font-size:28px}h2{font-size:20px;margin-top:36px}article+article{border-top:1px solid #ddd;margin-top:48px;padding-top:24px}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}thead{background:#f5f6fa}tbody th{min-width:80px}@media(max-width:480px){body{font-size:14px;padding:20px 16px}h1{font-size:24px}table{font-size:12px}th,td{padding:8px}}</style></head><body><nav><a href="/">PICO 홈</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보 수집·이용 및 처리방침</a><a href="contact-sharing.html">연락처 제공 동의</a></nav><p>시행일: 2026년 10월 6일 · 버전 ${version}</p>${documents.map(article).join('')}</body></html>\n`;
  const target = new URL(`${filename}.html`, directory);
  let previous;
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== undefined && previous !== html) throw new Error(`Published document changed: ${fileURLToPath(target)}. Publish a new version.`);
  await writeFile(target, html);
  manifest.push({ type, version, contentUrl: `https://pico-kr.app/legal/${version}/${filename}.html`, contentSha256: createHash('sha256').update(html).digest('hex'), effectiveAt: '2026-10-06T00:00:00' });
}
await writeFile(new URL('manifest.json', directory), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Verified ${manifest.length} immutable policy documents (${version}).`);
