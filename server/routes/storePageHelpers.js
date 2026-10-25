import sanitizeHtml from 'sanitize-html';

const MAX_STORE_PAGES = 50;
const MAX_PAGE_HTML_LENGTH = 100000;
const PAGE_PLACEMENTS = new Set(['footer', 'header', 'both', 'hidden']);

export function normalizeStorePages(input) {
  if (!Array.isArray(input) || input.length > MAX_STORE_PAGES) {
    throw new TypeError(`Store pages must be a list of no more than ${MAX_STORE_PAGES} entries.`);
  }
  const pageIds = new Set();
  const slugs = new Set();
  return input.map((page, index) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new TypeError('Each store page must be an object.');
    }
    const id = String(page.id || `store-page-${index + 1}`).trim();
    const title = String(page.title || '').trim();
    const slug = String(page.slug || title)
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const content = String(page.content || '');
    const placement = String(page.placement || 'footer');
    const order = Number(page.order ?? index);
    const image = String(page.image || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || pageIds.has(id)) {
      throw new TypeError('Store page IDs must be unique and no longer than 80 characters.');
    }
    if (!title || title.length > 120) {
      throw new TypeError('Each store page needs a title of no more than 120 characters.');
    }
    if (!slug || slug.length > 120 || slugs.has(slug) || ['cart', 'checkout', 'track', 'product'].includes(slug)) {
      throw new TypeError('Store page URLs must be unique and cannot use reserved storefront routes.');
    }
    if (content.length > MAX_PAGE_HTML_LENGTH) {
      throw new TypeError(`Page content must be no longer than ${MAX_PAGE_HTML_LENGTH} characters.`);
    }
    if (!PAGE_PLACEMENTS.has(placement)) {
      throw new TypeError('Store page menu placement must be footer, header, both, or hidden.');
    }
    if (page.enabled !== undefined && typeof page.enabled !== 'boolean') {
      throw new TypeError('Store page enabled must be true or false.');
    }
    if (!Number.isInteger(order) || order < 0 || order > MAX_STORE_PAGES) {
      throw new TypeError('Store page order must be a whole number from 0 to 50.');
    }
    if (image.length > 2000 || (image && !/^(https:\/\/|\/(?!\/))/i.test(image))) {
      throw new TypeError('Store page image must use an HTTPS URL or a site-relative path.');
    }
    pageIds.add(id);
    slugs.add(slug);
    return {
      id,
      title,
      slug,
      content: sanitizeHtml(content, {
        allowedTags: [
          'a', 'address', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'dd', 'del', 'details',
          'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'hr',
          'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub', 'summary',
          'sup', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
        ],
        allowedAttributes: {
          a: ['href', 'name', 'target', 'rel'],
          img: ['src', 'alt', 'title', 'width', 'height'],
          '*': ['class']
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        allowProtocolRelative: false,
        allowedClasses: {
          '*': ['align-left', 'align-center', 'align-right', 'text-center', 'text-left', 'text-right', 'text-muted']
        },
        transformTags: {
          a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }, true)
        }
      }),
      image,
      placement,
      enabled: page.enabled !== false,
      order
    };
  });
}
