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
    baseBackground: "Alex Chen grew up in a high-achieving family where expectations were always high. As a software engineer at a fast-paced startup, they're responsible for critical backend systems. Recently, they've been experiencing panic attacks before code reviews and have started avoiding team meetings. Their partner has noticed they're constantly checking their phone for work notifications even during dinner. Last month, they turned down a promotion because it would involve more presentations.",
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
    baseBackground: "Jordan Taylor used to be an avid painter and hiker, but hasn't touched their art supplies in six months. Working as a graphic designer, they find themselves staring at blank screens for hours. They recently cancelled a long-planned trip to visit their sister because they 'couldn't find the energy' to pack. Their roommate noticed they've been sleeping until noon on weekends and surviving on delivery food. Two months ago, they missed their best friend's birthday party because they 'didn't feel like being around people'.",
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
    baseBackground: "Morgan Rivera and their partner Jamie have been together for 7 years, but the last 8 months have been difficult. Morgan works as a nurse practitioner with irregular hours, while Jamie is a teacher who feels increasingly neglected. They had a major fight three weeks ago when Jamie discovered Morgan had been confiding in a coworker about their problems instead of talking to them. The silence between them has grown so heavy that Morgan now stays late at work just to avoid going home. They haven't been intimate in months, and their usual Sunday morning coffee dates have been replaced with separate activities.",
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
    baseBackground: "Dr. Samantha Lee is a senior manager at a consulting firm who hasn't taken a vacation day in 18 months. She's currently leading three major projects while mentoring five junior consultants. Last week, she forgot her own birthday until her mother called. Her gym membership expired six months ago and she hasn't noticed. She's developed a tremor in her right hand that her doctor says is stress-related. Two months ago, she missed her nephew's school play because she was 'too busy' with a client presentation that could have waited.",
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
    baseBackground: "Casey Morgan was in a serious car accident three years ago that left them with a broken leg and PTSD. They were a passenger when their friend fell asleep at the wheel. Now, they experience panic attacks when someone else is driving and haven't been in a car as a passenger since the accident. They work from home as a freelance writer and have arranged their life to avoid driving. Last month, they turned down a wedding invitation because it would require a 3-hour drive. They startle easily at car horns and have nightmares about rainy nights.",
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
    baseBackground: "Riley Anderson lost their mother to cancer six months ago after a two-year battle. They were the primary caregiver and had to quit their part-time job to provide care. Now, they're struggling to return to the workforce and feel guilty about considering going back to work. Their mother's garden, which they used to tend together, is overgrown with weeds. They still set an extra place at the dinner table sometimes. Last week, they found themselves driving to the hospital before remembering their appointments are no longer needed.",
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