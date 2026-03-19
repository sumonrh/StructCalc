import type { Material } from '@/types';

// Sample material data (Illustrative values, should be verified/expanded)
export const initialMaterials: Material[] = [
  // Steel
  {
    id: 'steel-astm-a36',
    name: 'ASTM A36 Steel',
    category: 'Steel',
    properties: {
      youngsModulus: 200, // GPa
      yieldStrength: 250, // MPa
      density: 7850, // kg/m³
      poissonsRatio: 0.3,
      thermalExpansionCoefficient: 12, // 10^-6 /°C
    },
    unitSystem: 'Metric',
  },
  {
    id: 'steel-astm-a572-gr50',
    name: 'ASTM A572 Gr. 50 Steel',
    category: 'Steel',
    properties: {
      youngsModulus: 200, // GPa
      yieldStrength: 345, // MPa
      density: 7850, // kg/m³
      poissonsRatio: 0.3,
      thermalExpansionCoefficient: 12, // 10^-6 /°C
    },
    unitSystem: 'Metric',
  },
  // Concrete
  {
    id: 'concrete-c25-30',
    name: 'C25/30 Concrete',
    category: 'Concrete',
    properties: {
      youngsModulus: 30, // GPa (Approx. varies with aggregate)
      compressiveStrength: 25, // MPa (Characteristic cylinder strength)
      density: 2400, // kg/m³ (Normal weight)
      poissonsRatio: 0.2,
      thermalExpansionCoefficient: 10, // 10^-6 /°C
    },
    unitSystem: 'Metric',
  },
    {
    id: 'concrete-4000psi',
    name: '4000 psi Concrete',
    category: 'Concrete',
    properties: {
      youngsModulus: 3600, // ksi (Approx.) -> 24.8 GPa
      compressiveStrength: 4, // ksi -> 27.6 MPa
      density: 150, // lb/ft³ -> 2400 kg/m³
      poissonsRatio: 0.2,
      thermalExpansionCoefficient: 5.5, // 10^-6 /°F -> 9.9 10^-6 /°C
    },
    unitSystem: 'Imperial',
  },
  // Timber (Example: Douglas Fir)
  {
    id: 'timber-douglas-fir-no2',
    name: 'Douglas Fir-Larch No. 2',
    category: 'Timber',
    properties: {
      youngsModulus: 11, // GPa (Approx. varies with moisture)
      bendingStrength: 8.6, // MPa (Fb value, example)
      density: 530, // kg/m³ (Approx.)
      // Poisson's ratio and thermal expansion are more complex for wood
    },
    unitSystem: 'Metric',
  },
];
