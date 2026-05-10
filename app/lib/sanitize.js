const ALLOWED_TAGS = ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'span'];

export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  // Supprimer scripts et handlers d'événements
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '');
  // Supprimer les tags non autorisés (garder le contenu)
  s = s.replace(/<\/?(?!(?:h2|h3|p|ul|ol|li|strong|em|br|span)(?:\s|\/?>))[a-z][^>]*>/gi, '');
  // Supprimer les attributs sur les tags autorisés sauf style basique
  s = s.replace(/(<(?:h2|h3|p|ul|ol|li|strong|em|span)\b)[^>]*(>)/gi, '$1$2');
  return s;
}
