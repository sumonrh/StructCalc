export type Material = {
  id: string;
  name: string;
  category: 'Steel' | 'Concrete' | 'Timber' | 'Custom';
  properties: {
    youngsModulus?: number; // E.g., in GPa or MPa
    yieldStrength?: number; // E.g., in MPa
    density?: number; // E.g., in kg/m³
    poissonsRatio?: number;
    thermalExpansionCoefficient?: number; // E.g., in 10^-6 /°C
    compressiveStrength?: number; // For concrete, e.g., in MPa
    bendingStrength?: number; // For timber, e.g., in MPa
    // Add other relevant properties
  };
  unitSystem: 'Metric' | 'Imperial';
};

// --- New Types for Structural Codes and Loads ---

export type LoadType = 'DL' | 'LL' | 'SL' | 'WL' | 'TL' | 'CL' | 'BK' | 'CR' | 'SH' | 'Other'; // Add more specific loads as needed

// Defines the factors for a specific load combination
export type LoadFactors = {
  [key in LoadType]?: number; // Optional: factor might not apply to all loads in a combo
};

// Represents a single load combination rule (e.g., 1.2D + 1.6L)
export interface LoadCombination {
  name: string; // e.g., "1.2D + 1.6L + 0.5S" or "ULS Combination 1"
  factors: LoadFactors;
  description?: string; // Optional description
}

// Represents a structural design code
export interface StructuralCode {
  id: string; // e.g., "NBCC_2020" or "ASCE_7_16"
  name: string; // e.g., "NBCC 2020" or "ASCE 7-16"
  defaultFactors: LoadFactors; // Default factors for individual load inputs
  ulsCombinations: LoadCombination[]; // Array of Ultimate Limit State combinations
  slsCombinations?: LoadCombination[]; // Optional: Serviceability Limit State combinations
}

// Represents the input loads provided by the user
export type InputLoads = {
  [key in LoadType]?: number; // User inputs load values (e.g., { DL: 100, LL: 150 })
};

// Represents the result of a load combination calculation
export interface CalculatedCombinationResult {
  combinationName: string;
  totalFactoredLoad: number;
  details: string; // e.g., "1.2*100 + 1.6*150 = 360"
}
