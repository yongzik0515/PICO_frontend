import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const legalDocuments = JSON.parse(await readFile(new URL('../src/legal/legalDocuments.json', import.meta.url), 'utf8'));

// Published bytes are immutable. Change the version when changing a published document.
const version = '2026-11-03.3';
const publishedDate = '2026년 11월 3일';
const privacyUrl = `/legal/${version}/privacy.html`;
const termsUrl = `/legal/${version}/terms.html`;
const contactUrl = `/legal/${version}/contact-sharing.html`;
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function article(document) {
  return `<article><h1>${escape(document.title)}</h1>${document.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}${section.rows.length ? `<div class="table"><table><thead><tr>${section.rows[0].map(c => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${section.rows.slice(1).map(row => `<tr>${row.map((c, i) => i ? `<td>${escape(c)}</td>` : `<th scope="row">${escape(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>` : ''}</section>`).join('')}</article>`;
}
const extensionVersion = '2026-11-05';
const manifest = [];
for (const [type, filename, documents, previousUrl] of [
  ['PRIVACY', 'privacy', [legalDocuments.signupPrivacy, legalDocuments.accountStorage, legalDocuments.privacy], '/legal/2026-11-03.2/privacy.html'],
  ['TERMS', 'terms', [legalDocuments.terms], '/legal/2026-11-03.2/terms.html'],
  ['CONTACT_SHARING', 'contact-sharing', [legalDocuments.contactSharing], '/legal/2026-11-03.2/contact-sharing.html'],
]) {
  const isExtendedTerms = type === 'TERMS';
  const documentVersion = isExtendedTerms ? extensionVersion : version;
  const documentTermsUrl = isExtendedTerms ? `/legal/${documentVersion}/terms.html` : termsUrl;
  const documentDate = isExtendedTerms ? '2026년 11월 5일' : publishedDate;
  const documentPreviousUrl = isExtendedTerms ? '/legal/2026-11-04/terms.html' : previousUrl;
  const directory = new URL(`../public/legal/${documentVersion}/`, import.meta.url);
  await mkdir(directory, { recursive: true });
  const effectiveAt = isExtendedTerms ? '2026-11-04T15:00:00' : '2026-11-02T15:00:00';
  const effectiveDate = documentDate;
  const html = `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(documents[0].title)} · PICO</title><style>body{max-width:880px;margin:0 auto;padding:24px 20px;color:#202632;font:16px/1.8 system-ui,sans-serif;word-break:keep-all;overflow-wrap:anywhere}nav{display:flex;flex-wrap:wrap;gap:16px;font-size:14px}a{color:#5144bd}h1{font-size:28px}h2{font-size:20px;margin-top:36px}article+article{border-top:1px solid #ddd;margin-top:48px;padding-top:24px}.table{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{border:1px solid #ddd;padding:12px;text-align:left;vertical-align:top}thead{background:#f5f6fa}tbody th{min-width:80px}@media(max-width:480px){body{font-size:14px;padding:20px 16px}h1{font-size:24px}table{font-size:12px}th,td{padding:8px}}</style></head><body><nav><a href="/">PICO 홈</a><a href="${documentTermsUrl}">이용약관</a><a href="${privacyUrl}">개인정보 수집·이용 및 처리방침</a><a href="${contactUrl}">연락처 및 도우미 실명 제공 동의</a></nav><p>게시일: ${documentDate} · 시행일: ${effectiveDate} · 버전 ${documentVersion}</p><p><a href="${documentPreviousUrl}">이전 버전 문서 보기</a></p>${documents.map(article).join('')}</body></html>\n`;
  const target = new URL(`${filename}.html`, directory);
  let previous;
  try { previous = await readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous !== undefined && previous !== html) throw new Error(`Published document changed: ${fileURLToPath(target)}. Publish a new version.`);
  await writeFile(target, html);
  if (isExtendedTerms) manifest.push({ type, version: documentVersion, contentUrl: `https://pico-kr.app/legal/${documentVersion}/${filename}.html`, contentSha256: createHash('sha256').update(html).digest('hex'), effectiveAt });
  console.log(`Verified immutable ${type} document (${documentVersion}).`);
}
await writeFile(new URL(`../public/legal/${extensionVersion}/manifest.json`, import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
