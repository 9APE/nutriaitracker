export interface CountryGuideline {
  code: string;
  name: string;
  authority: string;
  authorityUrl: string;
  systemPromptBlock: string;
  calorieNote: string;
}

export const COUNTRY_GUIDELINES: Record<string, CountryGuideline> = {
  AU: {
    code: "AU",
    name: "Australia",
    authority: "NHMRC",
    authorityUrl: "https://www.eatforhealth.gov.au/",
    systemPromptBlock:
      "Follow NHMRC (Australian National Health and Medical Research Council) Nutrient Reference Values 2017. Use Australian Dietary Guidelines 5 food groups. Reference eatforhealth.gov.au for food serving sizes. Always show both kcal and kJ values (1 kcal = 4.184 kJ).",
    calorieNote: "Based on NHMRC EER formulas (Eat for Health 2017).",
  },
  DE: {
    code: "DE",
    name: "Germany / EU",
    authority: "EFSA / DGE",
    authorityUrl: "https://efsa.europa.eu/",
    systemPromptBlock:
      "Follow EFSA Dietary Reference Values (DRV 2019) and Deutsche Gesellschaft für Ernährung (DGE) guidelines. Use EU portion size conventions. Cite efsa.europa.eu or dge.de.",
    calorieNote: "Based on EFSA DRV 2019 Population Reference Intakes.",
  },
  FR: {
    code: "FR",
    name: "France",
    authority: "ANSES",
    authorityUrl: "https://www.anses.fr/",
    systemPromptBlock:
      "Follow ANSES (Agence nationale de sécurité sanitaire) ANC 2021 guidelines. Reference Programme National Nutrition Santé (PNNS4) food pyramid. Cite anses.fr.",
    calorieNote: "Based on ANSES ANC 2021 recommendations.",
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    authority: "NHS / SACN",
    authorityUrl: "https://www.nhs.uk/",
    systemPromptBlock:
      "Follow NHS Eatwell Guide and SACN (Scientific Advisory Committee on Nutrition) Dietary Reference Values. Cite nhs.uk or gov.uk/government/organisations/scientific-advisory-committee-on-nutrition.",
    calorieNote: "Based on SACN Dietary Reference Values and NHS Eatwell Guide.",
  },
  US: {
    code: "US",
    name: "United States",
    authority: "USDA / FDA",
    authorityUrl: "https://www.dietaryguidelines.gov/",
    systemPromptBlock:
      "Follow USDA Dietary Guidelines for Americans 2020–2025 and FDA Daily Values (21 CFR 101.9). Reference MyPlate portions. Cite dietaryguidelines.gov or fda.gov.",
    calorieNote: "Based on USDA Dietary Guidelines 2020–2025 EER.",
  },
  IN: {
    code: "IN",
    name: "India",
    authority: "ICMR-NIN",
    authorityUrl: "https://www.nin.res.in/",
    systemPromptBlock:
      "Follow ICMR-NIN Dietary Guidelines for Indians 2024. Reference traditional Indian food patterns and regional diversity. Cite nin.res.in.",
    calorieNote: "Based on ICMR-NIN 2024 Recommended Dietary Allowances.",
  },
  OTHER: {
    code: "OTHER",
    name: "Global",
    authority: "WHO",
    authorityUrl: "https://www.who.int/",
    systemPromptBlock:
      "Follow WHO/FAO Nutrient Requirements 2004 and WHO Healthy Diet guidelines. Cite who.int.",
    calorieNote: "Based on WHO/FAO global nutrient recommendations.",
  },
};

export const COUNTRY_OPTIONS = [
  { code: "AU", flag: "🇦🇺", label: "Australia" },
  { code: "DE", flag: "🇩🇪", label: "Germany / EU" },
  { code: "FR", flag: "🇫🇷", label: "France" },
  { code: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { code: "US", flag: "🇺🇸", label: "United States" },
  { code: "IN", flag: "🇮🇳", label: "India" },
  { code: "OTHER", flag: "🌍", label: "Other (WHO)" },
];

export function getGuidelineForCountry(country?: string): CountryGuideline {
  if (!country) return COUNTRY_GUIDELINES["OTHER"];
  return COUNTRY_GUIDELINES[country] ?? COUNTRY_GUIDELINES["OTHER"];
}

export function buildCountryPromptBlock(country?: string): string {
  const g = getGuidelineForCountry(country);
  return `\n━━ NUTRITIONAL GUIDELINES AUTHORITY ━━\nThis user follows ${g.authority} guidelines (${g.name}).\n${g.systemPromptBlock}`;
}
