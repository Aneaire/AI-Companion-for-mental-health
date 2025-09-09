export function speak(text: string) {
  if (!("speechSynthesis" in window)) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  // You can choose a specific voice if needed
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(
    (v) => v.name.includes("Google") || v.lang === "en-US"
  );
  if (preferredVoice) utterance.voice = preferredVoice;

  window.speechSynthesis.cancel(); // Cancel any current speech
  window.speechSynthesis.speak(utterance);
}

