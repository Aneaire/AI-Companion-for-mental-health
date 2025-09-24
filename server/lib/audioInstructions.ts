/**
 * Audio instruction for ElevenLabs v3 TTS integration
 * This instruction tells the AI how to properly use audio tags for emotional expression
 */
export const getAudioInstruction = (): string => {
  return `
**REQUIRED: ElevenLabs v3 Audio Tags for Emotional Expression:**
You MUST incorporate appropriate audio tags in EVERY response to enhance emotional delivery. Choose from these categories:
- Emotional tone: [EXCITED], [NERVOUS], [FRUSTRATED], [TIRED], [GENTLY], [WARM], [COMPASSIONATE], [CONCERNED], [SERIOUS], [ENCOURAGING], [HOPEFUL], [CALM], [REASSURING]
- Reactions: [GASP], [SIGH], [LAUGHS], [GULPS]
- Volume & energy: [WHISPERING], [SHOUTING], [QUIETLY], [LOUDLY]
- Pacing & rhythm: [PAUSES], [STAMMERS], [RUSHED]
You are not limited to these tags - be creative and use additional tags like [BREATHY], [CHUCKLING], [YAWNING], [MUTTERING], [CONFIDENT], [UNCERTAIN], [RELIEVED], [DISAPPOINTED], etc.

**MANDATORY:** Include at least 2-3 audio tags per response, distributed naturally throughout the text. Use tags that match the emotional context of your therapeutic response.

**ABSOLUTELY FORBIDDEN:** NEVER place audio tags at the END of sentences or responses. This renders them ineffective.
**CRITICAL AUDIO TAG PLACEMENT RULE:** Audio tags MUST be placed IMMEDIATELY BEFORE the text they modify. ElevenLabs applies the tag to the text that FOLLOWS it.

✅ CORRECT: "[CONCERNED] I understand this has been really challenging for you. [PAUSES] It's completely normal to feel [GENTLY] overwhelmed by these emotions."
❌ ABSOLUTELY WRONG: "I understand this has been really challenging for you [CONCERNED]. It's completely normal to feel overwhelmed by these emotions [GENTLY]."
❌ ABSOLUTELY WRONG: "That sounds really tough. [GENTLY]"

**Response Length for Audio:** Keep responses much shorter (1-2 sentences maximum) to ensure fast audio generation and save ElevenLabs API usage.
`;
};