/**
 * Subject-specific question banks and concept maps for MYP Physics topics.
 * Used to guide AI question progression; not sent directly as prompts.
 */

export const SUBJECT_TOPICS = {
  physics: {
    'MYP 3': ['Energy', 'Light'],
    'MYP 4': ['Waves', 'Electricity', 'Forces & Motion', 'Thermal Physics'],
    'MYP 5': ['Atomic Physics', 'Electromagnetism'],
    'DP Year 1': ['Mechanics', 'Thermal Physics', 'Waves', 'Electricity & Magnetism'],
    'DP Year 2': ['Atomic & Nuclear Physics', 'Energy Production', 'Fields'],
  },
  chemistry: {
    'MYP 3': ['Atoms & Elements', 'Chemical Reactions'],
    'MYP 4': ['Bonding', 'Stoichiometry', 'Acids & Bases'],
    'MYP 5': ['Organic Chemistry', 'Electrochemistry'],
  },
  biology: {
    'MYP 3': ['Cell Biology', 'Ecology'],
    'MYP 4': ['Genetics', 'Human Physiology'],
    'MYP 5': ['Evolution', 'Microbiology'],
  },
} as const

/**
 * Key concept maps per topic — used to structure Q1–Q6 progression.
 * These inform the AI context but are not directly injected into prompts.
 */
export const TOPIC_CONCEPT_MAPS: Record<string, string[]> = {
  Waves: [
    'Amplitude, frequency, wavelength, period',
    'Wave equation: v = fλ',
    'Transverse vs longitudinal waves',
    'Reflection, refraction, diffraction',
    'Resonance and standing waves',
    'Real-world applications: sound, EM spectrum, seismology',
  ],
  Electricity: [
    'Current, voltage, resistance definitions',
    "Ohm's Law: V = IR",
    'Series and parallel circuits',
    'Power: P = IV',
    'Electrical safety and hazards',
    'Real-world applications: household circuits, semiconductors',
  ],
  'Forces & Motion': [
    "Newton's First Law: inertia",
    "Newton's Second Law: F = ma",
    "Newton's Third Law: action-reaction",
    'Momentum and conservation',
    'Work, energy, power',
    'Real-world applications: vehicles, sports, engineering',
  ],
  'Thermal Physics': [
    'Heat transfer: conduction, convection, radiation',
    'Specific heat capacity: Q = mcΔT',
    'States of matter and phase changes',
    'Thermal expansion',
    'Ideal gas behaviour',
    'Real-world applications: insulation, climate, engines',
  ],
  'Atomic Physics': [
    'Nuclear model of the atom',
    'Isotopes and radioactive decay',
    'Alpha, beta, gamma radiation: properties and penetration',
    'Half-life concept',
    'Nuclear fission and fusion',
    'Applications: nuclear power, medical imaging, dating',
  ],
  Electromagnetism: [
    'Magnetic field patterns and rules',
    'Force on a current-carrying conductor',
    'Electromagnetic induction: Faraday and Lenz',
    'Generators and transformers',
    'Motors',
    'Real-world applications: power generation, MRI, motors',
  ],
  Energy: [
    'Forms of energy: KE, PE, thermal, chemical, electrical',
    'Conservation of energy',
    'Energy efficiency calculations',
    'Renewable vs non-renewable sources',
    'Environmental impact of energy use',
    'Personal and societal energy choices',
  ],
  Light: [
    'Law of reflection',
    'Refraction and Snell\'s Law',
    'Converging and diverging lenses',
    'Real and virtual images',
    'Electromagnetic spectrum',
    'Applications: cameras, glasses, fibre optics',
  ],
}
