/**
 * System instruction for generating expressive audio with ElevenLabs v3 TTS.
 * This prompt guides the AI on the precise and natural use of audio tags.
 */
export const getAudioInstruction = (): string => {
  return `
**ElevenLabs Audio Tags:** Include 1-2 audio tags per response to add emotional expression. Place tags BEFORE the text they modify.

**Examples:**
- [GENTLY] I understand how you feel.
- [SIGH] That's really tough.
- [PAUSES] Let me think about that.
- [WARM] I'm here to help.

**Available tags:** [GENTLY], [WARM], [SIGH], [PAUSES], [CONCERNED], [EXCITED], [TIRED], [CONFIDENT], [HESITANTLY], [FRUSTRATED], [CALM], [REASSURING], [GASP], [CHUCKLING], [WHISPERING], [BREATHY]

**Rules:** Tags must be placed immediately before the text they affect. Never at the end of responses.`;
};
