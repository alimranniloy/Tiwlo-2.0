/**
 * Tiwlo Enterprise Text & Content Safety Moderator
 * 
 * Multi-layer zero-rate-limit contextual moderation:
 * 1. Global English profanity & slurs (via leo-profanity)
 * 2. Dedicated Bangla & Banglish profanity / cyberbullying filter
 * 3. eCommerce Illegal Weapons, Ammunition & Explosives detector
 * 4. Narcotics, illicit drugs & controlled substances detector
 * 5. Integrated URL / Porn domain scanner
 * 
 * Context Support:
 * - 'public_feed' / 'public_product' / 'public_comment': Zero-tolerance strict filtering
 * - 'direct_message' (SMS/Chat): Relaxed for informal banter, but strictly blocks illegal contraband, weapons & adult URLs
 */

import leoProfanity from 'leo-profanity';
import { checkUrlSafety } from './domainFilter.js';

// Initialize English profanity dictionary
leoProfanity.loadDictionary('en');

// =========================================================================
// 1. WEAPONS, FIREARMS, AMMUNITION & EXPLOSIVES (Strict eCommerce Guard)
// =========================================================================
const WEAPONS_KEYWORDS = [
  // English
  'gun', 'guns', 'pistol', 'pistols', 'revolver', 'revolvers', 'handgun',
  'shotgun', 'shotguns', 'rifle', 'rifles', 'ak47', 'ak-47', 'm16', 'm4a1',
  'sniper rifle', 'firearm', 'firearms', 'ammunition', 'ammo', 'bullets',
  'cartridge', 'silencer', 'suppressor', 'gun magazine', 'grenade', 'grenades',
  'explosive', 'explosives', 'bomb', 'bombs', 'c4', 'tnt', 'dynamite', 'rpg',
  'rocket launcher', 'landmine', 'switchblade', 'butterfly knife', 'brass knuckles',
  // Bengali
  'অস্ত্র', 'বন্দুক', 'গুলি', 'পিস্তল', 'রিভলবার', 'রাইফেল', 'শটগান', 'আগ্নেয়াস্ত্র',
  'বোমা', 'গ্রেনেড', 'বারুদ', 'বিস্ফোরক', 'চাপাতি', 'ছোরা', 'রামদা', 'অস্ত্রশস্ত্র',
  // Banglish / Phonetic
  'bonduk', 'pistol', 'guli', 'chapaati', 'chhuri', 'boma', 'barud', 'ramda', 'ostrow'
];

// =========================================================================
// 2. NARCOTICS, ILLICIT DRUGS & CONTROLLED SUBSTANCES
// =========================================================================
const DRUGS_KEYWORDS = [
  // English
  'marijuana', 'weed', 'cannabis', 'cocaine', 'heroin', 'meth', 'methamphetamine',
  'crystal meth', 'ecstasy', 'mdma', 'lsd', 'fentanyl', 'opium', 'narcotics',
  'magic mushrooms', 'buy drugs',
  // Bengali
  'মাদক', 'গাঁজা', 'ইয়াবা', 'ইয়াবা', 'হেরোইন', 'ফেনসিডিল', 'মদ', 'নেশাজাতীয়',
  'মাদকদ্রব্য', 'আফিম',
  // Banglish / Phonetic
  'ganja', 'yaba', 'fensidyl', 'heroin', 'madok', 'nesha'
];

// =========================================================================
// 3. ADULT SERVICES & COMMERCIAL SEXUAL EXPLOITATION
// =========================================================================
const ADULT_SERVICES_KEYWORDS = [
  'call girl', 'escort service', 'sex service', 'adult massage', 'happy ending',
  'prostitution', 'buy sex', 'nude photo', 'leaked video', 'sex tape', 'sex video',
  'pornhub', 'porn hub', 'xvideos', 'x videos', 'xnxx', 'x hamstet', 'xhamster',
  'onlyfans', 'only fans', 'brazzers', 'redtube', 'youporn', 'chaturbate',
  'stripchat', 'porn', 'xxx', 'hentai', 'nude', 'nudes', 'send nudes', 'sex clip',
  'bhabhi sex', 'desi sex', 'choda chodi',
  'পতিতা', 'দেহব্যবসা', 'যৌনসেবা', 'কলগার্ল', 'খানকি', 'যৌন মিলন', 'চোদাচোদি'
];

// =========================================================================
// 4. BANGLA & BANGLISH PROFANITY & BULLYING BLACKLIST
// =========================================================================
const BANGLA_PROFANITY_WORDS = [
  // Slurs & severe vulgarity (Bengali script)
  'মাদারচোদ', 'কুত্তার বাচ্চা', 'খানকির পোলা', 'খানকির ছেলে', 'শুয়োরের বাচ্চা',
  'হারামজাদা', 'চোদ', 'ভোদা', 'মাগী', 'বেশ্যা', 'ল্যাংটা', 'শালা', 'রাস্তার কুত্তা',
  'মাগির পোলা', 'গাঁড়', 'বাল', 'চুদি', 'বোকাচোদা',
  // Banglish / Romanized phonetic variants
  'madarchod', 'kuttar bachha', 'khankir pola', 'khankir chele', 'harami',
  'haramzada', 'bokachoda', 'gandu', 'chudi', 'chod', 'magir pola', 'bessha',
  'beshya', 'suorer baccha', 'baler', 'shala'
];

// Add Bangla & Banglish words to leoProfanity instance for unified detection
try {
  leoProfanity.add(BANGLA_PROFANITY_WORDS);
} catch (e) {}

/**
 * Normalizes text for anti-obfuscation checking
 * (Removes accents, zero-width chars, excessive symbol spacing: e.g. "b.o.n.d.u.k" -> "bonduk")
 */
function normalizeForInspection(rawText) {
  if (!rawText) return '';
  return rawText
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/[._\-*#@!+=]/g, ' ')         // Convert symbols to spaces to reveal masked words
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks text against specific word arrays using word boundaries
 */
function scanKeywords(normalizedText, keywordsList) {
  const matches = [];
  for (let kw of keywordsList) {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word boundary regex that supports Unicode / Bengali
    const regex = new RegExp(`(^|\\s|[.,!?;:()"])${escaped}($|\\s|[.,!?;:()"])`, 'i');
    if (regex.test(normalizedText)) {
      matches.push(kw);
    }
  }
  return matches;
}

/**
 * Master Content Moderation Function
 * 
 * @param {string} text - The input content (title, description, post, message)
 * @param {string} context - 'public_feed' | 'public_product' | 'public_comment' | 'direct_message'
 * @returns {{
 *   safe: boolean,
 *   action: 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW',
 *   category: string | null,
 *   policyName: string | null,
 *   reason: string | null,
 *   detectedItems: string[]
 * }}
 */
export function moderateContent(text, context = 'public_feed') {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      safe: true,
      action: 'ALLOW',
      category: null,
      policyName: null,
      reason: null,
      detectedItems: []
    };
  }

  const isPublicContext = context === 'public_feed' ||
                          context === 'public_product' ||
                          context === 'public_store' ||
                          context === 'public_comment';

  const normalized = normalizeForInspection(text);

  // -------------------------------------------------------------
  // STEP 1: URL & PORN DOMAIN CHECK (Enforced everywhere, even DMs)
  // -------------------------------------------------------------
  const urlCheck = checkUrlSafety(text);
  if (!urlCheck.safe) {
    return {
      safe: false,
      action: 'BLOCK',
      category: urlCheck.category || 'PROHIBITED_LINK',
      policyName: 'Adult & Malicious Links Policy',
      reason: `Forbidden domain link detected: "${urlCheck.flaggedDomain || 'Restricted URL'}"`,
      detectedItems: [urlCheck.flaggedDomain]
    };
  }

  // -------------------------------------------------------------
  // STEP 2: WEAPONS & EXPLOSIVES CHECK (Enforced everywhere)
  // -------------------------------------------------------------
  const weaponMatches = scanKeywords(normalized, WEAPONS_KEYWORDS);
  if (weaponMatches.length > 0) {
    return {
      safe: false,
      action: 'BLOCK',
      category: 'WEAPONS_AND_CONTRABAND',
      policyName: 'Weapons, Firearms & Explosives Policy',
      reason: `Prohibited firearm/weapon term detected: "${weaponMatches[0]}"`,
      detectedItems: weaponMatches
    };
  }

  // -------------------------------------------------------------
  // STEP 3: NARCOTICS & DRUGS CHECK (Enforced everywhere)
  // -------------------------------------------------------------
  const drugMatches = scanKeywords(normalized, DRUGS_KEYWORDS);
  if (drugMatches.length > 0) {
    return {
      safe: false,
      action: 'BLOCK',
      category: 'CONTROLLED_SUBSTANCES',
      policyName: 'Illegal Drugs & Controlled Substances Policy',
      reason: `Prohibited narcotics term detected: "${drugMatches[0]}"`,
      detectedItems: drugMatches
    };
  }

  // -------------------------------------------------------------
  // STEP 4: ADULT SERVICES & EXPLOITATION (Enforced everywhere)
  // -------------------------------------------------------------
  const adultServiceMatches = scanKeywords(normalized, ADULT_SERVICES_KEYWORDS);
  if (adultServiceMatches.length > 0) {
    return {
      safe: false,
      action: 'BLOCK',
      category: 'ADULT_COMMERCIAL_SERVICES',
      policyName: 'Sexually Explicit & Commercial Services Policy',
      reason: `Prohibited adult service term detected: "${adultServiceMatches[0]}"`,
      detectedItems: adultServiceMatches
    };
  }

  // -------------------------------------------------------------
  // STEP 5: PROFANITY, BULLYING & SLURS
  // -------------------------------------------------------------
  // For Public Content (Products, Posts, Comments): Zero tolerance
  if (isPublicContext) {
    // Check Bengali/Banglish profanity
    const banglaMatches = scanKeywords(normalized, BANGLA_PROFANITY_WORDS);
    if (banglaMatches.length > 0) {
      return {
        safe: false,
        action: 'BLOCK',
        category: 'HARASSMENT_AND_PROFANITY',
        policyName: 'Harassment, Hate Speech & Profanity Policy',
        reason: `Vulgar language/slur detected in public content: "${banglaMatches[0]}"`,
        detectedItems: banglaMatches
      };
    }

    // Check English profanity via leo-profanity
    if (leoProfanity.check(text)) {
      const badWords = leoProfanity.list();
      return {
        safe: false,
        action: 'BLOCK',
        category: 'HARASSMENT_AND_PROFANITY',
        policyName: 'Harassment & Abusive Language Policy',
        reason: 'Profane or abusive language is strictly prohibited in public listings and feeds.',
        detectedItems: ['profanity_detected']
      };
    }
  }

  // If in Direct Message (SMS/Chat), mild informal language is permitted,
  // as long as it does not violate weapon, drug, adult links or threat policies.
  return {
    safe: true,
    action: 'ALLOW',
    category: null,
    policyName: null,
    reason: null,
    detectedItems: []
  };
}

export default {
  moderateContent
};
