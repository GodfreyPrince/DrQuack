/**
 * Small mock medication reference. Placeholder data for the scaffold -
 * a production version would source this from a licensed drug database
 * (e.g. the open FDA API, national formularies) behind the same shape.
 */

export interface Medication {
  id: string;
  name: string;
  genericName: string;
  purpose: string;
  commonBrands: string[];
  requiresPrescription: boolean;
  warnings: string[];
  commonInteractions: string[];
}

export const MOCK_MEDICATIONS: Medication[] = [
  {
    id: "m-001",
    name: "Paracetamol",
    genericName: "acetaminophen",
    purpose: "Pain relief and fever reduction.",
    commonBrands: ["Calpol", "Dolo 650", "Tylenol", "Crocin"],
    requiresPrescription: false,
    warnings: [
      "Do not exceed 4 g (typically 8 tablets of 500 mg) per day in adults.",
      "Avoid combining with other products that also contain paracetamol.",
      "Liver disease or regular alcohol use - check with a doctor first.",
    ],
    commonInteractions: ["Warfarin (increased bleeding risk)", "Alcohol (liver toxicity)"],
  },
  {
    id: "m-002",
    name: "Ibuprofen",
    genericName: "ibuprofen",
    purpose: "Pain, inflammation, and fever reduction.",
    commonBrands: ["Brufen", "Advil", "Motrin"],
    requiresPrescription: false,
    warnings: [
      "Take with food to reduce stomach irritation.",
      "Avoid in the third trimester of pregnancy.",
      "Asthma, kidney disease, stomach ulcers, or on blood thinners - check first.",
    ],
    commonInteractions: [
      "Blood thinners (bleeding risk)",
      "Aspirin (reduced heart protection, higher ulcer risk)",
      "ACE inhibitors / diuretics (kidney risk)",
    ],
  },
  {
    id: "m-003",
    name: "Amoxicillin",
    genericName: "amoxicillin",
    purpose: "Antibiotic for bacterial infections.",
    commonBrands: ["Mox", "Amoxil", "Novamox"],
    requiresPrescription: true,
    warnings: [
      "Complete the full course exactly as prescribed.",
      "Antibiotics do not treat viral infections like the common cold.",
      "Allergic reaction (rash, swelling, breathing trouble) - stop and seek care.",
    ],
    commonInteractions: ["Oral contraceptives (may reduce effectiveness)", "Methotrexate"],
  },
  {
    id: "m-004",
    name: "Metformin",
    genericName: "metformin",
    purpose: "First-line oral medication for type 2 diabetes.",
    commonBrands: ["Glycomet", "Glucophage"],
    requiresPrescription: true,
    warnings: [
      "Common side effects: nausea and diarrhea, often temporary.",
      "Stop and seek urgent care if you develop severe vomiting or dehydration.",
      "Rare risk of lactic acidosis - report muscle pain, weakness, or breathing trouble.",
    ],
    commonInteractions: [
      "Iodinated contrast (imaging) - may need temporary pause",
      "Alcohol (lactic acidosis risk)",
    ],
  },
  {
    id: "m-005",
    name: "Amlodipine",
    genericName: "amlodipine",
    purpose: "Blood pressure control (calcium channel blocker).",
    commonBrands: ["Amlong", "Norvasc"],
    requiresPrescription: true,
    warnings: [
      "Can cause ankle swelling and flushing - report if bothersome.",
      "Do not stop suddenly; stopping can raise blood pressure sharply.",
      "Take the same time daily.",
    ],
    commonInteractions: ["Simvastatin (higher statin levels)", "Grapefruit juice"],
  },
  {
    id: "m-006",
    name: "Salbutamol",
    genericName: "albuterol",
    purpose: "Reliever inhaler for asthma and wheezing.",
    commonBrands: ["Asthalin", "Ventolin"],
    requiresPrescription: true,
    warnings: [
      "If relief does not last 4 hours or the inhaler is needed more often than usual, seek care.",
      "Wheezing that does not improve after repeated doses is an emergency.",
    ],
    commonInteractions: ["Beta blockers (may reduce effect)"],
  },
  {
    id: "m-007",
    name: "Omeprazole",
    genericName: "omeprazole",
    purpose: "Reduces stomach acid; heartburn and acid reflux.",
    commonBrands: ["Ocid", "Prilosec", "Omez"],
    requiresPrescription: false,
    warnings: [
      "Best taken 30-60 minutes before breakfast.",
      "Long-term use (months) should be reviewed by a doctor.",
      "Chest pain with shortness of breath is NOT heartburn - seek emergency care.",
    ],
    commonInteractions: ["Clopidogrel (reduced effect)", "Phenytoin"],
  },
  {
    id: "m-008",
    name: "Cetirizine",
    genericName: "cetirizine",
    purpose: "Antihistamine for allergies, hay fever, and hives.",
    commonBrands: ["Cetzine", "Zyrtec"],
    requiresPrescription: false,
    warnings: [
      "May cause drowsiness - avoid driving until you know how it affects you.",
      "Not for acute allergic emergencies - that needs epinephrine and urgent care.",
    ],
    commonInteractions: ["Alcohol and sedatives (increased drowsiness)"],
  },
];