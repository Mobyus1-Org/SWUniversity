export const pilotingCostByCardId: Record<string, number> = {
  // Jump to Lightspeed
  "JTL_148": 2, // Frisk
  "JTL_098": 2, // Snap Wexley
  "JTL_211": 1, // Independent Smuggler
  "JTL_046": 2, // Paige Tico
  "JTL_086": 1, // Wingman Victor Three
  "JTL_141": 2, // IG-88
  "JTL_145": 1, // BB-8
  "JTL_150": 1, // Briggs Darklighter
  "JTL_139": 2, // Dengar
  "JTL_048": 2, // Cassian Andor
  "JTL_058": 2, // Academy Graduate
  "JTL_034": 3, // Interceptor Ace
  "JTL_187": 2, // Bossk
  "JTL_084": 1, // Wingman Victor Two
  "JTL_245": 0, // R2-D2
  "JTL_215": 2, // BoShek
  "JTL_210": 2, // The Mandalorian
  "JTL_093": 1, // Nien Nunb
  "JTL_203": 2, // Han Solo (Has His Moments)
  "JTL_103": 3, // Chewbacca
  "JTL_196": 1, // Dagger Squadron Pilot
  "JTL_189": 2, // Boba Fett
  "JTL_197": 2, // Anakin Skywalker
  "JTL_036": 3, // Iden Versio
  "JTL_045": 2, // Hera Syndulla
  "JTL_094": 3, // Luke Skywalker (You Still With Me?)
  "JTL_100": 2, // Poe Dameron (One Hell of a Pilot)
  "JTL_057": 2, // Astromech Pilot
  "JTL_246": 2, // Hopeful Volunteer
  "JTL_255": 1, // Sullustan Spacer
  "JTL_035": 2, // Tam Ryvora
  "JTL_066": 1, // Trace Martez
  "JTL_108": 2, // Clone Pilot
  "JTL_159": 2, // Determined Recruit
  "JTL_236": 1, // Indoctrinated Conscript
  "JTL_049": 3, // L3-37
  "JTL_142": 3, // Darth Vader (Scourge of Squadrons)
  "JTL_109": 2, // Jarek Yeager
};

export function PilotingCost(cardId: string)
{
  return pilotingCostByCardId[cardId] ?? -1;
}