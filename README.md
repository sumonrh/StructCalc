# StrucTCalc

**StrucTCalc** is a high-fidelity professional structural engineering suite built with Next.js, ShadCN UI, and Tailwind CSS. It is designed for engineers who require precision tools for design, analysis, and verification within a modern, high-performance environment.

## Key Modules

### 1. 2D Static Analysis (FEA)
- **Interactive Solver:** Draw nodes and members, apply supports (pinned, roller, fixed), and add point or uniform loads.
- **Dynamic Diagrams:** Real-time Shear Force (SFD), Bending Moment (BMD), and Reaction analysis.
- **Precision Tracking:** Live coordinate display and member-point result interpolation via cursor hover.

### 2. Live Load Analysis
- **Advanced FEM Engine:** Moving load analysis for multi-span continuous beams.
- **CL-625 Compliance:** Built-in axle profiles for standard truck and lane loading cases.
- **Pattern Loading:** Automatically generates envelopes for UDL and point load combinations.
- **Export:** Comprehensive Excel export for design documentation.

### 3. Steel Girder Capacity
- **I-Girder & Box Girder:** Specialized resistance calculators compliant with CSA S6-19.
- **Detailed Checks:** Lateral-torsional buckling (LTB), shear buckling with tension field action, and section classification.
- **Professional Reports:** Integrated PDF generator for formal engineering submittals.

### 4. RC Column Moment Curvature
- **Nonlinear Analysis:** Circular and rectangular fiber-section solver using Mander (concrete) and Park (steel) models.
- **Visualizations:** Interactive MC/MR diagrams and cross-section previews.

### 5. Component Design
- **RC Beam Section:** Dual-layer reinforcement design with ductility verification and CSA S6-19 compliance.
- **Biaxial Footing Stress:** Numerical no-tension solver for foundation pressure under eccentric loading with 2D plan and profile visualizations.
- **Buckling & Deflection:** Quick verification tools for standard member cases.

## Deployment to Firebase

This app is configured for **Firebase App Hosting**. 

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Navigate to **App Hosting** and connect your GitHub repository.
3. Use the following terminal commands to push your local code to your repository:

```bash
git init
git add .
git commit -m "Initialize StrucTCalc"
git branch -M main
git remote add origin https://github.com/sumonrh/StructCalc.git
git push -u origin main
```

## License

This project is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license.

---
Built with precision by **Firebase Studio**.
