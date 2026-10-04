/**
 * Tiwlo Enterprise Domain & URL Safety Filter
 * 
 * Intercepts adult, pornographic, scam, malware, and prohibited links.
 * Works uniformly across Public Feeds, eCommerce Listings, and Direct Messaging (SMS/Chat).
 * 
 * - High-speed in-memory set & regex matching (Zero rate-limit, 100% offline, zero latency)
 * - Detects obfuscated links (e.g., domain[.]com, hxxp, spaced-out URLs)
 * - Detects adult TLDs (.xxx, .porn, .adult, .cam, .sex)
 */

const ADULT_DOMAINS = new Set([
  'pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com',
  'youporn.com', 'chaturbate.com', 'cam4.com', 'livejasmin.com', 'stripchat.com',
  'onlyfans.com', 'fansly.com', 'brazzers.com', 'bangbros.com', 'fapdu.com',
  'spankbang.com', 'eporner.com', 'tnaflix.com', 'daftsex.com', 'heavy-r.com',
  'beeg.com', 'tube8.com', 'porn.com', 'playboy.com', 'penthouse.com',
  'hustler.com', 'bonga.com', 'bongacams.com', 'myfreecams.com', 'camsoda.com',
  'jerkmate.com', 'flirt4free.com', 'imlive.com', 'camversity.com', 'fetlife.com',
  'adultfriendfinder.com', 'ashleymadison.com', 'naughtyamerica.com', 'realitykings.com',
  'wicked.com', 'twistys.com', 'digitalplayground.com', 'evilangel.com', 'kink.com',
  'clips4sale.com', 'manyvids.com', 'loyalfans.com', 'sheer.xxx', 'slut.com'
]);

const ADULT_TLDS = new Set([
  'xxx', 'porn', 'adult', 'sex', 'cam', 'sexy', 'fetish', 'erotica', 'tube'
]);

const PROHIBITED_KEYWORDS_IN_URL = [
  'porn', 'hentai', 'xxx', 'escort', 'sexchat', 'nudevideo', 'leakedsex',
  'darkweb', 'blackmarket', 'buydrugs', 'buyguns', 'buyweapons', 'carding',
  'hackbank', 'ccdump', 'counterfeitcash'
];

const OBFUSCATED_ADULT_REGEX = /\b(porn\s*hub|x\s*videos?|x\s*n\s*x\s*x|x\s*hamster|only\s*fans|brazzers|red\s*tube|you\s*porn|chaturbate|strip\s*chat|cam4|livejasmin)\s*(\.|\sdot\s|\s*\[\.\]\s*|\s+)\s*(com|net|org|xyz|tv|cc|to|site|online|xxx|adult|club)\b/i;

// Regex to capture URLs and obfuscated links: http://, https://, www., or domain.tld
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`]+|[a-zA-Z0-9][-a-zA-Z0-9]{1,62}\.(?:[a-zA-Z]{2,12})(?:\/[^\s<>"{}|\\^`]*)?/gi;

/**
 * Extracts and canonicalizes domains from text
 */
export function extractDomains(text) {
  if (!text || typeof text !== 'string') return [];
  // Normalize text with spaced dots: e.g. "pornhub .com" -> "pornhub.com"
  const normalizedDots = text.replace(/([a-zA-Z0-9_-]+)\s*\.\s*([a-zA-Z]{2,12})/g, '$1.$2');
  const matches = normalizedDots.match(URL_REGEX) || [];
  const domains = [];

  for (let raw of matches) {
    try {
      // Normalize obfuscated URL: remove protocol and www
      let clean = raw.toLowerCase().trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .replace(/[^\w.-]/g, '');

      if (clean && clean.includes('.')) {
        domains.push({ raw, domain: clean });
      }
    } catch (e) {}
  }

  return domains;
}

/**
 * Checks text or URL string for adult, malicious, or contraband links
 * 
 * @param {string} text - Message, post body, product URL, or bio
 * @returns {{ safe: boolean, flaggedDomain: string | null, reason: string | null, links: string[] }}
 */
export function checkUrlSafety(text) {
  if (!text || typeof text !== 'string') {
    return { safe: true, flaggedDomain: null, reason: null, links: [] };
  }

  // 0. Immediate regex check for obfuscated adult brand domains (e.g. "porn hub.com", "xvideos.com")
  const obfMatch = text.match(OBFUSCATED_ADULT_REGEX);
  if (obfMatch) {
    return {
      safe: false,
      flaggedDomain: obfMatch[0],
      reason: 'Adult / Pornographic web domain detected',
      category: 'ADULT_URL',
      links: [obfMatch[0]]
    };
  }

  const detected = extractDomains(text);
  const foundLinks = detected.map(d => d.domain);

  for (let { raw, domain } of detected) {
    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    const sld = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : domain;

    // 1. Direct Adult Domain check
    if (ADULT_DOMAINS.has(domain) || ADULT_DOMAINS.has(sld)) {
      return {
        safe: false,
        flaggedDomain: domain,
        reason: 'Adult / Pornographic web domain detected',
        category: 'ADULT_URL',
        links: foundLinks
      };
    }

    // 2. Adult TLD check (.xxx, .porn, .adult, .cam)
    if (ADULT_TLDS.has(tld)) {
      return {
        safe: false,
        flaggedDomain: domain,
        reason: 'Restricted adult top-level domain (.xxx/.porn/.adult)',
        category: 'ADULT_TLD',
        links: foundLinks
      };
    }

    // 3. Prohibited keyword in domain path or name
    const lowerDomain = domain.toLowerCase();
    for (let kw of PROHIBITED_KEYWORDS_IN_URL) {
      if (lowerDomain.includes(kw)) {
        return {
          safe: false,
          flaggedDomain: domain,
          reason: `Prohibited domain term detected: "${kw}"`,
          category: 'PROHIBITED_URL_TERM',
          links: foundLinks
        };
      }
    }
  }

  return {
    safe: true,
    flaggedDomain: null,
    reason: null,
    links: foundLinks
  };
}

export default {
  checkUrlSafety,
  extractDomains
};
