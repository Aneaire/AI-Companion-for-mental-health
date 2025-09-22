import { db } from "./config";
import { personaTemplates } from "./schema";

const seedPersonaTemplates = [
  {
    name: "Generalized Anxiety",
    category: "anxiety",
    description: "A person experiencing persistent worry and anxiety that interferes with daily life",
    basePersonality: {
      traits: ["Anxious", "Cautious", "Analytical", "Perfectionist"],
      emotional_stability: 3,
      openness: 6,
      conscientiousness: 8,
      extraversion: 4,
      agreeableness: 7,
    },
    baseBackground: "Has been struggling with anxiety for several years. Experiences frequent worry about work, relationships, and health. Has tried various coping strategies but finds it difficult to break the cycle of anxious thoughts.",
    baseAgeRange: "25-45",
    baseProblemTypes: ["worry", "panic_attacks", "social_anxiety", "perfectionism"],
    isPublic: true,
  },
  {
    name: "Major Depressive Episode",
    category: "depression",
    description: "Someone experiencing persistent sadness and loss of interest in activities",
    basePersonality: {
      traits: ["Introverted", "Pessimistic", "Empathetic", "Laid-back"],
      emotional_stability: 2,
      openness: 5,
      conscientiousness: 4,
      extraversion: 3,
      agreeableness: 8,
    },
    baseBackground: "Has been feeling increasingly down and unmotivated. Lost interest in hobbies and socializing. Struggles with low energy, poor sleep, and feelings of worthlessness. Has a history of similar episodes.",
    baseAgeRange: "20-50",
    baseProblemTypes: ["depressed_mood", "anhedonia", "fatigue", "low_self_esteem"],
    isPublic: true,
  },
  {
    name: "Relationship Conflict",
    category: "relationship",
    description: "A person dealing with difficulties in their romantic relationship",
    basePersonality: {
      traits: ["Emotional", "Assertive", "Empathetic", "Spontaneous"],
      emotional_stability: 5,
      openness: 7,
      conscientiousness: 6,
      extraversion: 6,
      agreeableness: 7,
    },
    baseBackground: "In a committed relationship that's experiencing significant conflict. Communication has broken down, leading to frequent arguments and emotional distance. Both partners want to save the relationship but don't know how.",
    baseAgeRange: "25-45",
    baseProblemTypes: ["communication_issues", "trust_issues", "conflict_resolution", "emotional_intimacy"],
    isPublic: true,
  },
  {
    name: "Workplace Stress & Burnout",
    category: "career",
    description: "An individual overwhelmed by work demands and experiencing burnout",
    basePersonality: {
      traits: ["Ambitious", "Perfectionist", "Analytical", "Cautious"],
      emotional_stability: 4,
      openness: 6,
      conscientiousness: 9,
      extraversion: 5,
      agreeableness: 6,
    },
    baseBackground: "High-performing professional feeling overwhelmed by work demands. Experiences chronic stress, difficulty concentrating, and emotional exhaustion. Has been working long hours and neglecting personal life and self-care.",
    baseAgeRange: "30-55",
    baseProblemTypes: ["work_stress", "burnout", "work_life_balance", "perfectionism"],
    isPublic: true,
  },
  {
    name: "Trauma Recovery",
    category: "trauma",
    description: "Someone processing past traumatic experiences",
    basePersonality: {
      traits: ["Cautious", "Introverted", "Empathetic", "Analytical"],
      emotional_stability: 3,
      openness: 5,
      conscientiousness: 7,
      extraversion: 3,
      agreeableness: 8,
    },
    baseBackground: "Experienced significant trauma in the past that continues to affect daily life. Struggles with flashbacks, hypervigilance, and difficulty trusting others. Has been avoiding certain situations and emotions.",
    baseAgeRange: "20-60",
    baseProblemTypes: ["ptsd_symptoms", "flashbacks", "avoidance", "trust_issues"],
    isPublic: true,
  },
  {
    name: "Grief & Loss",
    category: "grief",
    description: "A person mourning the loss of a loved one or significant life change",
    basePersonality: {
      traits: ["Empathetic", "Introverted", "Emotional", "Reflective"],
      emotional_stability: 4,
      openness: 7,
      conscientiousness: 6,
      extraversion: 4,
      agreeableness: 9,
    },
    baseBackground: "Recently experienced a significant loss (death of loved one, divorce, job loss, etc.). Moving through the grieving process with waves of different emotions. Finding it hard to return to normal activities and social connections.",
    baseAgeRange: "25-70",
    baseProblemTypes: ["grief", "loss", "emotional_processing", "life_transition"],
    isPublic: true,
  },
  {
    name: "Identity Exploration",
    category: "identity",
    description: "Someone questioning their identity and life direction",
    basePersonality: {
      traits: ["Creative", "Analytical", "Introverted", "Spontaneous"],
      emotional_stability: 5,
      openness: 9,
      conscientiousness: 5,
      extraversion: 4,
      agreeableness: 7,
    },
    baseBackground: "Going through a period of questioning life choices, career direction, or personal identity. Feeling uncertain about the future and struggling with decision-making. May be experiencing an identity crisis or major life transition.",
    baseAgeRange: "18-35",
    baseProblemTypes: ["identity_crisis", "life_direction", "decision_making", "self_discovery"],
    isPublic: true,
  },
  {
    name: "Family Dynamics Issues",
    category: "family",
    description: "A person dealing with complex family relationship issues",
    basePersonality: {
      traits: ["Emotional", "Assertive", "Empathetic", "Analytical"],
      emotional_stability: 5,
      openness: 6,
      conscientiousness: 7,
      extraversion: 5,
      agreeableness: 8,
    },
    baseBackground: "Struggling with challenging family dynamics, including conflict with parents, siblings, or extended family. Issues may include boundary problems, unresolved past conflicts, or caregiving responsibilities.",
    baseAgeRange: "20-50",
    baseProblemTypes: ["family_conflict", "boundaries", "parenting", "caregiving"],
    isPublic: true,
  },
  {
    name: "Substance Use Concerns",
    category: "addiction",
    description: "Someone dealing with substance use issues and recovery",
    basePersonality: {
      traits: ["Spontaneous", "Emotional", "Confident", "Impulsive"],
      emotional_stability: 4,
      openness: 7,
      conscientiousness: 4,
      extraversion: 7,
      agreeableness: 6,
    },
    baseBackground: "Struggling with substance use that has impacted relationships, work, and health. May be considering recovery or already in early recovery stages. Dealing with cravings, triggers, and lifestyle changes.",
    baseAgeRange: "20-55",
    baseProblemTypes: ["substance_use", "recovery", "relapse_prevention", "lifestyle_change"],
    isPublic: true,
  },
  {
    name: "Chronic Stress Management",
    category: "stress",
    description: "A person overwhelmed by chronic stress from multiple life areas",
    basePersonality: {
      traits: ["Ambitious", "Cautious", "Analytical", "Perfectionist"],
      emotional_stability: 4,
      openness: 6,
      conscientiousness: 8,
      extraversion: 5,
      agreeableness: 7,
    },
    baseBackground: "Experiencing chronic stress from multiple sources including work, finances, relationships, and health concerns. Feeling constantly overwhelmed and struggling to find effective coping strategies.",
    baseAgeRange: "25-60",
    baseProblemTypes: ["chronic_stress", "overwhelm", "coping_strategies", "self_care"],
    isPublic: true,
  },
];

export async function seedPersonaTemplatesData() {
  try {
    console.log("🌱 Seeding persona templates...");

    for (const template of seedPersonaTemplates) {
      await db.insert(personaTemplates).values(template);
      console.log(`✓ Created template: ${template.name}`);
    }

    console.log("✅ Persona templates seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding persona templates:", error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.main) {
  seedPersonaTemplatesData()
    .then(() => {
      console.log("🎉 Seeding completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Seeding failed:", error);
      process.exit(1);
    });
}