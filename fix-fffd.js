const fs = require('fs');
let str = fs.readFileSync('app/landing/page.js', 'utf8');
const FFFD = '�';

// Fix 1: CSS content property — decorative opening quote " (U+201C)
str = str.replace(/content:'[�ž][œž]?'/, "content:'\\201C'");

// Fix 2: All price amounts — FFFD after digits or commas = €
// Pattern: digit + FFFD (optionally followed by more digits)
str = str.replace(/(\d)[�]/g, '$1€');

// Fix 3: Waitlist loading spinner — '…'
str = str.replace(/wlLoading \? '[�]'/, "wlLoading ? '…'");

// Fix 4: glycemia act — "→ Stable FFFD" → "→ Stable —" (em dash)
// Also remove the erroneous right quote char that follows
str = str.replace(/→ Stable [�]["“”]?\s/, '→ Stable — ');

// Fix 5: Comments {/* ─── X ─── */} — restore ─ (U+2500)
str = str.replace(/{\/\* "?[�]"?[�] /g, '{/* ─── ');
str = str.replace(/ [�]"?[�]"? \*\/}/g, ' ─── */}');

// Fix 6: inline comments {/* 1 FFFD" bilan sanguin */} → {/* 1 — bilan sanguin */}
str = str.replace(/\{\/\* (\d) [�][""]? /g, '{/* $1 — ');

// Fix 7: social proof stars — ★★★★★ (5 stars)
// Look for star patterns
// Already good probably, check
const remaining = (str.match(/[�]/g) || []).length;
console.log('Remaining FFFD chars:', remaining);

// Show any remaining
let idx = -1, i = 0;
while ((idx = str.indexOf(FFFD, idx + 1)) !== -1 && i < 10) {
  console.log('  @'+idx+':', JSON.stringify(str.slice(Math.max(0,idx-20), idx+20)));
  i++;
}

fs.writeFileSync('app/landing/page.js', str, 'utf8');
console.log('Written.');
