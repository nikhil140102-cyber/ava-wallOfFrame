// The 22 languages of the Eighth Schedule of the Constitution of India, plus English.
// `script` picks the font; `dir` is the writing direction; `intl` is the tag used for dates and numbers.
export const LOCALES = [
  { code: "en", name: "English", native: "English", script: "Latn", dir: "ltr", intl: "en-IN" },
  { code: "as", name: "Assamese", native: "অসমীয়া", script: "Beng", dir: "ltr", intl: "as-IN" },
  { code: "bn", name: "Bengali", native: "বাংলা", script: "Beng", dir: "ltr", intl: "bn-IN" },
  { code: "brx", name: "Bodo", native: "बड़ो", script: "Deva", dir: "ltr", intl: "brx-IN" },
  { code: "doi", name: "Dogri", native: "डोगरी", script: "Deva", dir: "ltr", intl: "doi-IN" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", script: "Gujr", dir: "ltr", intl: "gu-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", script: "Deva", dir: "ltr", intl: "hi-IN" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", script: "Knda", dir: "ltr", intl: "kn-IN" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر", script: "Arab", dir: "rtl", intl: "ks-Arab-IN" },
  { code: "kok", name: "Konkani", native: "कोंकणी", script: "Deva", dir: "ltr", intl: "kok-IN" },
  { code: "mai", name: "Maithili", native: "मैथिली", script: "Deva", dir: "ltr", intl: "mai-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", script: "Mlym", dir: "ltr", intl: "ml-IN" },
  { code: "mni", name: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ", script: "Mtei", dir: "ltr", intl: "mni-Mtei-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", script: "Deva", dir: "ltr", intl: "mr-IN" },
  { code: "ne", name: "Nepali", native: "नेपाली", script: "Deva", dir: "ltr", intl: "ne-IN" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", script: "Orya", dir: "ltr", intl: "or-IN" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Guru", dir: "ltr", intl: "pa-IN" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्", script: "Deva", dir: "ltr", intl: "sa-IN" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Olck", dir: "ltr", intl: "sat-Olck-IN" },
  { code: "sd", name: "Sindhi", native: "सिन्धी", script: "Deva", dir: "ltr", intl: "sd-Deva-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", script: "Taml", dir: "ltr", intl: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", script: "Telu", dir: "ltr", intl: "te-IN" },
  { code: "ur", name: "Urdu", native: "اردو", script: "Arab", dir: "rtl", intl: "ur-IN" },
];

export const DEFAULT_LOCALE = "en";
export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const localeInfo = (code) => LOCALES.find((l) => l.code === code) ?? LOCALES[0];
export const isLocale = (code) => LOCALE_CODES.includes(code);

/** Best match for an Accept-Language header, e.g. "hi-IN,hi;q=0.9,en;q=0.8" → "hi". */
export function matchLocale(header) {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const base = tag.split("-")[0];
    if (isLocale(tag)) return tag;
    if (isLocale(base)) return base;
  }
  return null;
}
