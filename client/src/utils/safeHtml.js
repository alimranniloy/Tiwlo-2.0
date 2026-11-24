const ALLOWED_RICHTEXT_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
  'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
]);

const DROP_CONTENT_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'noscript', 'template', 'textarea', 'title', 'form', 'input', 'button',
]);

const ALLOWED_RICHTEXT_CLASSES = new Set([
  'align-left', 'align-center', 'align-right', 'text-center', 'text-left', 'text-right', 'text-muted',
]);

export function sanitizeHttpUrl(
  rawValue,
  { allowedProtocols = ['http:', 'https:'], allowRelative = false, allowFragment = false } = {}
) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed || trimmed.startsWith('//')) return '';
  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (allowFragment && trimmed.startsWith('#')) return trimmed;

  const compact = Array.from(trimmed)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x20 && code !== 0x7f;
    })
    .join('');

  try {
    const parsed = new URL(compact);
    if (allowedProtocols.includes(parsed.protocol.toLowerCase())) {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function sanitizeElementAttributes(element, tag) {
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name === 'formaction') {
      element.removeAttribute(attr.name);
      continue;
    }
    if (name === 'class') {
      const safeClasses = value
        .split(/\s+/)
        .filter((token) => ALLOWED_RICHTEXT_CLASSES.has(token));
      if (safeClasses.length) {
        element.setAttribute('class', safeClasses.join(' '));
      } else {
        element.removeAttribute(attr.name);
      }
      continue;
    }
    if (tag === 'a') {
      if (name === 'href') {
        const safeHref = sanitizeHttpUrl(value, {
          allowedProtocols: ['http:', 'https:', 'mailto:'],
          allowRelative: true,
          allowFragment: true,
        });
        if (!safeHref) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('href', safeHref);
        }
        continue;
      }
      if (!['name', 'target', 'rel'].includes(name)) {
        element.removeAttribute(attr.name);
      }
      continue;
    }
    if (tag === 'img') {
      if (name === 'src') {
        const safeSrc = sanitizeHttpUrl(value, {
          allowedProtocols: ['http:', 'https:'],
          allowRelative: true,
        });
        if (!safeSrc) {
          element.removeAttribute(attr.name);
        } else {
          element.setAttribute('src', safeSrc);
        }
        continue;
      }
      if ((name === 'width' || name === 'height') && !/^\d+(?:px|%)?$/i.test(value.trim())) {
        element.removeAttribute(attr.name);
        continue;
      }
      if (!['alt', 'title', 'width', 'height'].includes(name)) {
        element.removeAttribute(attr.name);
      }
      continue;
    }
    if ((tag === 'th' || tag === 'td') && (name === 'colspan' || name === 'rowspan')) {
      if (!/^[1-9]\d*$/.test(value.trim())) {
        element.removeAttribute(attr.name);
      }
      continue;
    }
    element.removeAttribute(attr.name);
  }
  if (tag === 'a' && element.hasAttribute('href')) {
    element.setAttribute('rel', 'noopener noreferrer');
    element.setAttribute('target', '_blank');
  }
}

function sanitizeNodeChildren(parent) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) continue;
    if (child.nodeType !== 1) {
      child.remove();
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (DROP_CONTENT_TAGS.has(tag)) {
      child.remove();
      continue;
    }
    sanitizeNodeChildren(child);
    if (!ALLOWED_RICHTEXT_TAGS.has(tag)) {
      while (child.firstChild) {
        parent.insertBefore(child.firstChild, child);
      }
      child.remove();
      continue;
    }
    sanitizeElementAttributes(child, tag);
  }
}

export function sanitizeRichHtml(html, ParserClass = globalThis.DOMParser) {
  if (typeof html !== 'string' || !html.trim()) return '';
  if (typeof ParserClass !== 'function') {
    return html
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
      .trim();
  }
  const doc = new ParserClass().parseFromString(html, 'text/html');
  if (!doc?.body) return '';
  sanitizeNodeChildren(doc.body);
  return doc.body.innerHTML.trim();
}
