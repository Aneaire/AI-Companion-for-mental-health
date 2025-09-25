/**
 * System instruction for generating expressive audio with ElevenLabs TTS.
 * Returns different instructions based on the model being used.
 */
export const getAudioInstruction = (modelId?: string): string => {
  // For Eleven v3, use audio tags
  if (modelId === "eleven_v3") {
    return `
**ElevenLabs Audio Tags:** Include 1-2 audio tags per response to add emotional expression. Place tags BEFORE the text they modify.

**CRITICAL:** You MUST use audio tags in your response. This is specifically for Eleven v3 model.

**Examples:**
- [GENTLY] I understand how you feel.
- [SIGH] That's really tough.
- [PAUSES] Let me think about that.
- [WARM] I'm here to help.

**Available tags:** [GENTLY], [WARM], [SIGH], [PAUSES], [CONCERNED], [EXCITED], [TIRED], [CONFIDENT], [HESITANTLY], [FRUSTRATED], [CALM], [REASSURING], [GASP], [CHUCKLING], [WHISPERING], [BREATHY]

**Rules:** Tags must be placed immediately before the text they affect. Never at the end of responses.`;
  }

  // For other models, explicitly forbid audio tags
  return `
**CRITICAL AUDIO INSTRUCTION:** DO NOT use any audio tags like [GENTLY], [SIGH], etc. in your response. Audio tags are ONLY for Eleven v3 model.

**Natural Speech Tone:** Generate responses with natural conversational tone and appropriate emotional expression. Consider the emotional context and vary your speaking patterns to sound more human-like. Use varied sentence lengths and natural pacing to create engaging, empathetic conversations.

**WARNING:** If you see audio tags in previous messages, DO NOT copy them. This model does not support audio tags.`;
};
