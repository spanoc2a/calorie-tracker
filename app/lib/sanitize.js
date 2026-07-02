import DOMPurify from 'isomorphic-dompurify';

// Les rapports générés (coach/report) n'utilisent que h2/p/ul/li/strong ;
// l'en-tête marque blanche utilise div/span (ses attributs style/img étaient
// déjà retirés par l'ancien sanitizer regex → aucun attribut autorisé ici).
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
];

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  // DOMPurify est l'autorité : allowlist stricte de tags, aucun attribut.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
  });
}
