const fs = require('fs');
let str = fs.readFileSync('app/landing/page.js', 'utf8');

const FFFD = '�';
const RQUOTE = '”'; // right double quotation mark "
const LQUOTE = '“'; // left double quotation mark "
const EM_DASH = '—'; // —
const ELLIPSIS = '…'; // …
const BOX_H = '─';   // ─ (box drawing)

// Fix 1: CSS decorative quote content:'ž€'/ content:'žœ' → content:'"'
// The char is FFFD + U+0153 (œ)
str = str.replace(new RegExp(`content:'${FFFD}\\u0153'`), `content:'${LQUOTE}'`);
// Also try the CSS escape form
str = str.replace(/content:'[^']{1,5}'/g, (m) => {
  if (m.includes(FFFD)) return `content:'“'`;
  return m;
});

// Fix 2: Comments {/* "ž"ž SECTION "ž"ž */} → {/* ─── SECTION ─── */}
// The pattern is RQUOTE + FFFD + RQUOTE + FFFD
const badDashes = new RegExp(`${RQUOTE}${FFFD}${RQUOTE}${FFFD}`, 'g');
const triDash = `${BOX_H}${BOX_H}${BOX_H}`;
str = str.replace(badDashes, triDash);

// Fix 3: Inline comments {/* 1 ž" section */} → {/* 1 — section */}
// U+FFFD + RQUOTE
const badInline = new RegExp(`${FFFD}${RQUOTE}`, 'g');
str = str.replace(badInline, EM_DASH);

// Fix 4: Waitlist loading indicator
str = str.replace(new RegExp(`wlLoading \\? '${FFFD}'`), `wlLoading ? '${ELLIPSIS}'`);

// Fix 5: Glycemia act "→ Stable FFFD" → "→ Stable —"
str = str.replace(new RegExp(`Stable ${FFFD}[${RQUOTE}${LQUOTE}]?\\s`), `Stable ${EM_DASH} `);

// Check results
const remaining = (str.match(new RegExp(FFFD, 'g')) || []).length;
console.log('Remaining FFFD:', remaining);
let idx = -1, i = 0;
while ((idx = str.indexOf(FFFD, idx + 1)) !== -1 && i < 10) {
  console.log('  @'+idx+':', JSON.stringify(str.slice(Math.max(0,idx-25), idx+30)));
  i++;
}

// Verify visible fixes
const cmtSample = str.indexOf('{/* ───');
if (cmtSample > -1) console.log('Comment fixed:', JSON.stringify(str.slice(cmtSample, cmtSample+25)));
const cssSample = str.indexOf("content:'");
if (cssSample > -1) console.log('CSS content:', JSON.stringify(str.slice(cssSample, cssSample+20)));

fs.writeFileSync('app/landing/page.js', str, 'utf8');
console.log('Written.');
