/** Reference list of commercial aircraft models a virtual airline's fleet would
 * plausibly operate - used purely as autocomplete suggestions when adding fleet
 * (see AircraftPage.tsx's <datalist>), not a hard enum. The Model field stays
 * free text so a plane missing from this list can still be entered manually.
 *
 * Deliberately airliners, regional/commuter aircraft, and cargo/charter types
 * only - no fighter jets, bombers, or other military hardware (a B-2 Spirit is
 * not a fleet asset no matter how good Roblox's asset library's autocomplete
 * game made it look). */
export const AIRCRAFT_MODELS = [
  "Airbus A220",
  "Airbus A319",
  "Airbus A320",
  "Airbus A321",
  "Airbus A330",
  "Airbus A340",
  "Airbus A350",
  "Airbus A380",
  "Antonov An-124",
  "Antonov An-225",
  "ATR 42",
  "ATR 72",
  "Beechcraft King Air 260",
  "Boeing 707",
  "Boeing 717",
  "Boeing 727",
  "Boeing 737",
  "Boeing 747",
  "Boeing 757",
  "Boeing 767",
  "Boeing 777",
  "Boeing 787",
  "Bombardier CRJ700",
  "Bombardier CRJ900",
  "Bombardier Learjet",
  "Bombardier Q400",
  "Cessna Caravan",
  "Cirrus Vision SF50",
  "Concorde",
  "De Havilland Comet",
  "DHC-6 Twin Otter",
  "Embraer E170",
  "Embraer E175",
  "Embraer E190",
  "Embraer E195",
  "Lockheed L-1011 TriStar",
  "McDonnell Douglas DC-10",
  "McDonnell Douglas MD-11",
  "McDonnell Douglas MD-80",
  "McDonnell Douglas MD-90",
] as const;
