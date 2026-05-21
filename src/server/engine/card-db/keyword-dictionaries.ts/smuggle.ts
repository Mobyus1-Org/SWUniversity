export function SmuggleCost(cardId: string): number {
  switch (cardId) {
    case "SHD_065": return 7;
    case "SHD_252": return 3;
    case "SHD_149": return 5;
    case "SHD_113": return 6;
    case "SHD_204": return 6;
    case "SHD_089": return 7;
    case "SHD_203": return 6;
    case "SHD_097": return 4;
    case "SHD_160": return 3;
    case "SHD_174": return 3;
    case "SHD_248": return 4;
    case "SHD_184": return 4;
    case "SHD_075": return 3;
    case "SHD_129": return 2;
    case "SHD_032": return 5;
    case "SHD_197": return 4;
    case "SHD_215": return 4;
    case "SHD_086": return 4;
    case "SHD_119": return 5;
    case "SHD_111": return 3;
    case "SHD_148": return 5;
    case "SHD_050": return 9;
    case "SHD_052": return 6;
    case "SHD_201": return 6;
    case "SHD_175": return 4;
    case "SHD_127": return 3;
    case "SHD_213": return 7;
    case "SHD_225": return 4;
    case "SHD_107": return 6;
    case "SHD_217": return 5;
    default: return -1;
  }
}

const smuggleAspectsByCardId: Record<string, string[]> = {
  "SHD_032": ["Vigilance", "Villainy"],
  "SHD_050": ["Aggression", "Heroism"],
  "SHD_052": ["Vigilance"],
  "SHD_065": ["Vigilance"],
  "SHD_075": ["Vigilance"],
  "SHD_086": ["Command", "Villainy"],
  "SHD_089": ["Command", "Villainy"],
  "SHD_097": ["Command", "Heroism"],
  "SHD_107": ["Command", "Command"],
  "SHD_111": ["Command"],
  "SHD_113": ["Command"],
  "SHD_119": ["Command"],
  "SHD_127": ["Command"],
  "SHD_129": ["Command"],
  "SHD_148": ["Aggression", "Heroism"],
  "SHD_149": ["Aggression", "Heroism"],
  "SHD_160": ["Aggression"],
  "SHD_174": ["Cunning"],
  "SHD_175": ["Aggression"],
  "SHD_184": ["Cunning", "Villainy"],
  "SHD_197": ["Cunning", "Heroism"],
  "SHD_201": ["Cunning", "Heroism"],
  "SHD_203": ["Cunning", "Heroism"],
  "SHD_204": ["Cunning", "Heroism"],
  "SHD_213": ["Cunning", "Cunning"],
  "SHD_215": ["Cunning"],
  "SHD_217": ["Vigilance"],
  "SHD_225": ["Cunning"],
  "SHD_248": ["Heroism"],
  "SHD_252": ["Heroism"],
};

export function SmuggleAspects(cardId: string): string[] {
  return smuggleAspectsByCardId[cardId] ?? [];
}
