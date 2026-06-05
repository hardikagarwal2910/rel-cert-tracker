/**
 * v1.1.3 — location label helper. Guarantees two same-company locations are
 * always distinguishable: "Nickname — City" when a nickname is set, else
 * "Company — City".
 */
import { locationLabel, locationAddressLines, locationAddressOneLine } from '@/lib/location-label';

describe('locationLabel', () => {
  it('returns "Nickname — City" when a nickname is set', () => {
    expect(locationLabel({ nickname: 'Shilaj Unit', name: 'Raghuvir Exim Limited', city: 'Ahmedabad' }))
      .toBe('Shilaj Unit — Ahmedabad');
  });

  it('falls back to "Company — City" when nickname is blank/whitespace/missing', () => {
    expect(locationLabel({ nickname: '', name: 'Raghuvir Exim Limited', city: 'Surat' }))
      .toBe('Raghuvir Exim Limited — Surat');
    expect(locationLabel({ nickname: '   ', name: 'Raghuvir Exim Limited', city: 'Ahmedabad' }))
      .toBe('Raghuvir Exim Limited — Ahmedabad');
    expect(locationLabel({ nickname: null, name: 'Raghuvir Exim Limited', city: 'Mumbai' }))
      .toBe('Raghuvir Exim Limited — Mumbai');
  });

  it('disambiguates two same-company locations by city even with no nicknames', () => {
    const a = locationLabel({ name: 'Raghuvir Exim Limited', city: 'Ahmedabad' });
    const b = locationLabel({ name: 'Raghuvir Exim Limited', city: 'Surat' });
    expect(a).not.toBe(b);
    expect(a).toBe('Raghuvir Exim Limited — Ahmedabad');
    expect(b).toBe('Raghuvir Exim Limited — Surat');
  });

  it('omits the dash when there is no city', () => {
    expect(locationLabel({ nickname: 'Head Office', name: 'REL' })).toBe('Head Office');
  });
});

describe('locationAddressLines / locationAddressOneLine', () => {
  const loc = {
    address_line_1: 'Plot 42, GIDC',
    address_line_2: 'Phase II',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380058',
    country: 'India',
  };

  it('produces discrete non-empty address lines', () => {
    expect(locationAddressLines(loc)).toEqual([
      'Plot 42, GIDC',
      'Phase II',
      'Ahmedabad, Gujarat, 380058',
      'India',
    ]);
  });

  it('skips blank optional fields', () => {
    expect(locationAddressLines({ address_line_1: 'Plot 42', city: 'Surat', state: 'Gujarat', pincode: '395003', country: 'India' }))
      .toEqual(['Plot 42', 'Surat, Gujarat, 395003', 'India']);
  });

  it('one-line joins the lines with commas', () => {
    expect(locationAddressOneLine(loc)).toBe('Plot 42, GIDC, Phase II, Ahmedabad, Gujarat, 380058, India');
  });
});
