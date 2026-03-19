import type { StructuralCode } from '@/types';

// Define some common structural codes and their load combinations (simplified)
// Units are assumed to be consistent (e.g., kN for loads)
// These are illustrative and may not cover all cases or specific code nuances.
export const structuralCodes: StructuralCode[] = [
  {
    id: 'NBCC_2020',
    name: 'NBCC 2020 (Building)',
    defaultFactors: { DL: 1.25, LL: 1.50, SL: 1.50, WL: 1.40, TL: 1.25 }, // Principal factors
    ulsCombinations: [
      { name: '1.4D', factors: { DL: 1.4 } },
      { name: '1.25D + 1.5L', factors: { DL: 1.25, LL: 1.5 } },
      { name: '1.25D + 1.5S + 0.5L', factors: { DL: 1.25, SL: 1.5, LL: 0.5 } },
      { name: '1.25D + 1.5S + 0.4W', factors: { DL: 1.25, SL: 1.5, WL: 0.4 } },
      { name: '1.25D + 1.4W + 0.5L', factors: { DL: 1.25, WL: 1.4, LL: 0.5 } },
      { name: '1.25D + 1.4W + 0.5S', factors: { DL: 1.25, WL: 1.4, SL: 0.5 } },
      { name: '1.25D + 1.25T + 0.5L', factors: { DL: 1.25, TL: 1.25, LL: 0.5 } }, // Example T combo
      { name: '1.0D + 1.5L', factors: { DL: 1.0, LL: 1.5 } }, // Counteracting DL
      { name: '1.0D + 1.4W', factors: { DL: 1.0, WL: 1.4 } }, // Uplift/Overturning
      { name: '1.0D + 1.5S', factors: { DL: 1.0, SL: 1.5 } }, // Uplift/Overturning
      // Add more NBCC combinations as needed (e.g., Earthquake, exceptional loads)
    ],
  },
  {
    id: 'CHBDC_S6_19',
    name: 'CHBDC S6:19 (Bridge)',
    defaultFactors: { DL: 1.20, LL: 1.70, WL: 1.40, CL: 1.0, BK: 1.0, CR: 1.0, SH: 1.0, TL: 1.0 }, // ULS Group 1 simplified
    ulsCombinations: [
      // Simplified examples, real CHBDC has load groups and modification factors
      { name: 'ULS 1: 1.2D + 1.7L', factors: { DL: 1.20, LL: 1.70 } }, // Primary Live Load
      { name: 'ULS 3: 1.2D + 1.4W', factors: { DL: 1.20, WL: 1.40 } }, // Primary Wind Load
      { name: 'ULS 5: 1.0D + 1.0CL', factors: { DL: 1.0, CL: 1.0 } }, // Collision Load (Simplified)
      { name: 'ULS Fatigue: 0.9L', factors: { LL: 0.9 } }, // Fatigue Limit State example
      { name: 'SLS: 1.0D + 1.0L', factors: { DL: 1.0, LL: 1.0 } }, // Serviceability example
       // Combinations with Creep (CR), Shrinkage (SH), Temperature (T) are complex and often involve specific analysis
    ],
  },
  {
    id: 'ASCE_7_16',
    name: 'ASCE 7-16 (Building)',
    defaultFactors: { DL: 1.2, LL: 1.6, SL: 1.6, WL: 1.0 }, // Common factors
    ulsCombinations: [
        { name: '1.4D', factors: { DL: 1.4 } },
        { name: '1.2D + 1.6L + 0.5S', factors: { DL: 1.2, LL: 1.6, SL: 0.5 } },
        { name: '1.2D + 1.6S + (1.0L or 0.5W)', factors: { DL: 1.2, SL: 1.6, LL: 1.0 } }, // S Primary, L Comp
        { name: '1.2D + 1.6S + (1.0L or 0.5W)', factors: { DL: 1.2, SL: 1.6, WL: 0.5 } }, // S Primary, W Comp
        { name: '1.2D + 1.0W + 1.0L + 0.5S', factors: { DL: 1.2, WL: 1.0, LL: 1.0, SL: 0.5 } }, // W Primary
        { name: '0.9D + 1.0W', factors: { DL: 0.9, WL: 1.0 } }, // Uplift
        // Add Earthquake (E) and other load combinations
    ],
  },
];

// Helper function to get a code by ID
export const getCodeById = (id: string): StructuralCode | undefined => {
  return structuralCodes.find(code => code.id === id);
};

// Define load types for cleaner code
export type LoadType = 'DL' | 'LL' | 'SL' | 'WL' | 'TL' | 'CL' | 'BK' | 'CR' | 'SH' | 'Other'; // Add more as needed

export const loadTypeDetails: Record<LoadType, { label: string; description: string; unit: string }> = {
    DL: { label: 'Dead Load', description: 'Permanent structural and non-structural loads.', unit: 'kN or kips' },
    LL: { label: 'Live Load', description: 'Occupancy, furniture, equipment loads (may be reducible).', unit: 'kN or kips' },
    SL: { label: 'Snow Load', description: 'Load due to snow accumulation.', unit: 'kN or kips' },
    WL: { label: 'Wind Load', description: 'Load due to wind pressure or suction.', unit: 'kN or kips' },
    TL: { label: 'Thermal Effects', description: 'Loads due to temperature changes.', unit: 'kN or kips (equiv.)' },
    CL: { label: 'Collision Load', description: 'Load from vehicle or vessel impact (bridges).', unit: 'kN or kips' },
    BK: { label: 'Braking Force', description: 'Longitudinal force from vehicle braking (bridges).', unit: 'kN or kips' },
    CR: { label: 'Creep Effects', description: 'Long-term deformation effects (concrete).', unit: 'kN or kips (equiv.)' },
    SH: { label: 'Shrinkage Effects', description: 'Volume change effects (concrete).', unit: 'kN or kips (equiv.)' },
    Other: { label: 'Other Load', description: 'User-defined load type.', unit: 'kN or kips' }
};
