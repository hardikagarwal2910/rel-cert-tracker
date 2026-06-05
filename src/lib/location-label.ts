// Single source of truth for rendering a location in COMPACT contexts
// (dropdowns, list rows, cert detail line, group headers).
//
// name     = legal/company entity name (may repeat across sites)
// nickname = short internal label (e.g. "Shilaj Unit") — preferred when set
//
// Falling back to "Company — City" guarantees two same-company locations are
// still distinguishable by city even before anyone sets a nickname.

export interface LocationLabelInput {
  name: string;
  nickname?: string | null;
  city?: string | null;
}

/** Compact label, e.g. "Shilaj Unit — Ahmedabad" or "Raghuvir Exim Limited — Surat". */
export function locationLabel(loc: LocationLabelInput): string {
  const nick = loc.nickname?.trim();
  const base = nick && nick.length > 0 ? nick : loc.name;
  const city = loc.city?.trim();
  return city ? `${base} — ${city}` : base;
}

export interface LocationAddressInput {
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}

/** Full address as discrete lines (for multi-line display on detail pages). */
export function locationAddressLines(loc: LocationAddressInput): string[] {
  const cityStatePin = [loc.city, loc.state, loc.pincode].filter(Boolean).join(', ');
  return [loc.address_line_1, loc.address_line_2, cityStatePin, loc.country]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0);
}

/** Full address on one line (for compact-but-complete display, e.g. list rows). */
export function locationAddressOneLine(loc: LocationAddressInput): string {
  return locationAddressLines(loc).join(', ');
}
