export const PROPERTY_FURNISHING_DICTIONARY: Record<string, 'FULLY' | 'SEMI' | 'UNFURNISHED'> = {
  'ff': 'FULLY',
  'fully': 'FULLY',
  'fully furnished': 'FULLY',
  'sf': 'SEMI',
  'semi': 'SEMI',
  'semi furnished': 'SEMI',
  'nf': 'UNFURNISHED',
  'unfurnished': 'UNFURNISHED',
  'non furnished': 'UNFURNISHED'
};

export const OCCUPANT_DICTIONARY: Record<string, 'BACHELOR' | 'FAMILY' | 'COUPLE' | 'WORKING_PROFESSIONALS' | 'STUDENTS' | 'AIRBNB_OPERATORS'> = {
  'bachelor': 'BACHELOR',
  'single': 'BACHELOR',
  'single guy': 'BACHELOR',
  'single girl': 'BACHELOR',
  'family': 'FAMILY',
  'couple': 'COUPLE',
  'married': 'COUPLE',
  'working professionals': 'WORKING_PROFESSIONALS',
  'working professional': 'WORKING_PROFESSIONALS',
  'job': 'WORKING_PROFESSIONALS',
  'professional': 'WORKING_PROFESSIONALS',
  'students': 'STUDENTS',
  'student': 'STUDENTS',
  'college': 'STUDENTS',
  'airbnb': 'AIRBNB_OPERATORS',
  'airbnb operator': 'AIRBNB_OPERATORS',
  'commercial leasing': 'AIRBNB_OPERATORS'
};

export const LANDMARK_DICTIONARY: Record<string, string> = {
  'gcr': 'Golf Course Road',
  'golf course road': 'Golf Course Road',
  'golf course extension road': 'Golf Course Extension Road',
  'gcr ext': 'Golf Course Extension Road',
  'gcrext': 'Golf Course Extension Road',
  'cyber city': 'Cyber City',
  'cybercity': 'Cyber City',
  'cyber hub': 'Cyber Hub',
  'cyberhub': 'Cyber Hub',
  'rapid metro': 'Rapid Metro',
  'rapidmetro': 'Rapid Metro',
  'vyapar kendra': 'Vyapar Kendra',
  'vyaparkendra': 'Vyapar Kendra',
  'one horizon': 'One Horizon',
  'onehorizon': 'One Horizon',
  'sushant lok': 'Sushant Lok',
  'sushant lok 1': 'Sushant Lok 1',
  'sushant lok-1': 'Sushant Lok 1',
  'sushant lok 2': 'Sushant Lok 2',
  'sushant lok-2': 'Sushant Lok 2',
  'sushant lok 3': 'Sushant Lok 3',
  'sushant lok-3': 'Sushant Lok 3',
  'ardee city': 'Ardee City',
  'ardeecity': 'Ardee City',
  'greenwood city': 'Greenwood City',
  'greenwoodcity': 'Greenwood City',
  'south city': 'South City',
  'southcity': 'South City',
  'nirvana country': 'Nirvana Country',
  'nirvanacountry': 'Nirvana Country',
  'malibu towne': 'Malibu Towne',
  'malibutowne': 'Malibu Towne',
  'dlf phase 1': 'DLF Phase 1',
  'dlf ph 1': 'DLF Phase 1',
  'dlf 1': 'DLF Phase 1',
  'dlf phase 2': 'DLF Phase 2',
  'dlf ph 2': 'DLF Phase 2',
  'dlf 2': 'DLF Phase 2',
  'dlf phase 3': 'DLF Phase 3',
  'dlf ph 3': 'DLF Phase 3',
  'dlf 3': 'DLF Phase 3',
  'dlf phase 4': 'DLF Phase 4',
  'dlf ph 4': 'DLF Phase 4',
  'dlf 4': 'DLF Phase 4',
  'dlf phase 5': 'DLF Phase 5',
  'dlf ph 5': 'DLF Phase 5',
  'dlf 5': 'DLF Phase 5'
};

export const PROPERTY_TYPE_DICTIONARY: Record<string, string[]> = {
  '1rk': ['1RK'],
  '1rks': ['1RK'],
  'studio': ['STUDIO'],
  'studios': ['STUDIO'],
  '1bhk': ['1BHK'],
  '1bhks': ['1BHK'],
  '2bhk': ['2BHK'],
  '2bhks': ['2BHK'],
  '2.5 bhk': ['2BHK', '3BHK'],
  '2.5 bhks': ['2BHK', '3BHK'],
  '2.5bhk': ['2BHK', '3BHK'],
  '2.5bhks': ['2BHK', '3BHK'],
  '3bhk': ['3BHK'],
  '3bhks': ['3BHK'],
  '4bhk': ['4BHK'],
  '4bhks': ['4BHK'],
  'builder floor': ['BUILDER_FLOOR'],
  'builder floors': ['BUILDER_FLOOR'],
  'builderfloor': ['BUILDER_FLOOR'],
  'builderfloors': ['BUILDER_FLOOR'],
  'floor': ['BUILDER_FLOOR'],
  'floors': ['BUILDER_FLOOR'],
  'villa': ['VILLA'],
  'villas': ['VILLA'],
  'kothi': ['VILLA'],
  'kothis': ['VILLA'],
  'commercial shop': ['COMMERCIAL_SHOP'],
  'commercial shops': ['COMMERCIAL_SHOP'],
  'shop': ['COMMERCIAL_SHOP'],
  'shops': ['COMMERCIAL_SHOP'],
  'office': ['OFFICE'],
  'offices': ['OFFICE'],
  'office space': ['OFFICE'],
  'office spaces': ['OFFICE'],
  'officespace': ['OFFICE'],
  'officespaces': ['OFFICE'],
  'plot': ['PLOT'],
  'plots': ['PLOT'],
  'commercial': ['COMMERCIAL'],
  'pg': ['PG'],
  'pgs': ['PG'],
  'co-living': ['CO_LIVING'],
  'co living': ['CO_LIVING']
};

/**
 * Normalizes input text into standard Mr Homes CRM terms using dictionary mapping rules.
 */
export function normalizeFurnishing(input: string): 'FULLY' | 'SEMI' | 'UNFURNISHED' | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  return PROPERTY_FURNISHING_DICTIONARY[clean] || null;
}

export function normalizeOccupant(input: string): 'BACHELOR' | 'FAMILY' | 'COUPLE' | 'WORKING_PROFESSIONALS' | 'STUDENTS' | 'AIRBNB_OPERATORS' | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  return OCCUPANT_DICTIONARY[clean] || null;
}

export function normalizeLandmark(input: string): string | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  return LANDMARK_DICTIONARY[clean] || input;
}

export function normalizePropertyTypes(inputs: string[]): string[] {
  if (!inputs || !Array.isArray(inputs)) return [];
  const normalized = new Set<string>();
  inputs.forEach(input => {
    const clean = input.trim().toLowerCase();
    const matches = PROPERTY_TYPE_DICTIONARY[clean] || [];
    if (matches.length > 0) {
      matches.forEach(m => normalized.add(m));
    } else {
      const uppercase = clean.toUpperCase().replace(/\s+/g, '_');
      normalized.add(uppercase);
    }
  });
  return Array.from(normalized);
}
