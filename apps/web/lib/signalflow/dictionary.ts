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
  'dlf phase 2': 'DLF Phase 2',
  'dlf ph 2': 'DLF Phase 2',
  'dlf 2': 'DLF Phase 2',
  'dlf phase 3': 'DLF Phase 3',
  'dlf ph 3': 'DLF Phase 3',
  'dlf 3': 'DLF Phase 3',
  'dlf phase 4': 'DLF Phase 4',
  'dlf ph 4': 'DLF Phase 4',
  'dlf 4': 'DLF Phase 4'
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
  return LANDMARK_DICTIONARY[clean] || input; // Fall back to original input text if no specific shorthand match
}
