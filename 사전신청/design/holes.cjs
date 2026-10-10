const fs = require('fs');
const dir = __dirname + '/project/';
for (const f of fs.readdirSync(dir).filter((n) => /^M\d+-.*\.dc\.html$/.test(n))) {
  const s = fs.readFileSync(dir + f, 'utf8');
  const [tpl, script] = s.split('<script type="text/x-dc"');
  const holes = new Set([...tpl.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1].split('.')[0]).filter((h) => !['true', 'false', 'o'].includes(h)));
  const ret = script.slice(script.lastIndexOf('return {'));
  const keys = new Set([...ret.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]));
  const missing = [...holes].filter((h) => !keys.has(h));
  const unused = [...keys].filter((k) => !holes.has(k));
  const count = (re) => (tpl.match(re) || []).length;
  const bal = ['sc-if', 'sc-for', 'div', 'section', 'span', 'button', 'a', 'label', 'nav', 'ol', 'li', 'p', 'h1', 'h2', 'h3', 'header']
    .map((t) => [t, count(new RegExp('<' + t + '(?=[\\s>])', 'g')) - count(new RegExp('</' + t + '>', 'g'))])
    .filter(([, d]) => d !== 0);
  console.log(f, '| missing:', missing.join(',') || '-', '| unused:', unused.join(',') || '-', '| unbalanced:', JSON.stringify(bal));
}
