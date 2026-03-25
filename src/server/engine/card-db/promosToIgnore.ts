// Set codes to skip entirely when building dictionaries and fetching images.
// Cards from these sets are promos or exclusives that duplicate an original card.
export const promosToIgnore = [
  "C24",
  "C25",
  "GG",
  "J24",
  "J25",
  "JTLP",
  "LOFP",
  "P25",
  "P26",
  "SECP",
] as const;

export type PromoSetCode = (typeof promosToIgnore)[number];
