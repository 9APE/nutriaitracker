/** Common world cuisines users can pick from. */
export const COMMON_CUISINES = [
  "Italian",
  "Mediterranean",
  "Mexican",
  "Japanese",
  "Thai",
  "Indian",
  "Chinese",
  "Korean",
  "Vietnamese",
  "Middle Eastern",
  "French",
  "German",
  "Spanish",
  "Greek",
  "American",
  "British",
  "Caribbean",
  "African",
  "Brazilian",
] as const;

export type Cuisine = typeof COMMON_CUISINES[number] | string;
