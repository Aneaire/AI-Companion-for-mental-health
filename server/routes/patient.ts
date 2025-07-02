import { GoogleGenerativeAI } from "@google/generative-ai";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { geminiConfig } from "server/lib/config";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const patientRoute = new Hono().post("/", async (c) => {
  const body = await c.req.json();
  const { message, context, patientProgressLevel = 0 } = body;

  // Prepare conversation history for the AI
  const conversationHistory = (context || []).map((msg: any) => ({
    role: msg.role === "model" ? "model" : "user",
    parts: [{ text: msg.text }],
  }));
  // Ensure the first message is from user (if it's not empty)
  // This is a Gemini specific requirement for `startChat` history.
  if (
    conversationHistory.length > 0 &&
    conversationHistory[0].role === "model" &&
    (conversationHistory[0].parts[0]?.text || "").trim() === ""
  ) {
    // If the first message is a dummy model message, remove it for the system instruction.
    // We'll add the real current user message later.
    // Or, if it's a dummy user message for Gemini, keep it, but ensure it doesn't skew problem detection.
  }

  // --- IMPROVEMENT AREA 1: Better Problem Extraction from Context ---
  // More robustly extract the user's initial problem/form data from the context.
  // The 'context' here originates from the 'initialForm' in the main chat handler.
  let initialProblemOrContext = "";
  // Look for the user's initial form data that was likely sent as the first user message
  if (Array.isArray(context) && context.length > 0) {
    const initialFormMessage = context.find(
      (msg: any) =>
        msg.role === "user" && msg.text.includes("User Initial Information:")
    );
    if (initialFormMessage) {
      initialProblemOrContext = initialFormMessage.text;
    }
  }

  // If there's no initial form, or this is a fresh conversation without it,
  // the first actual 'message' (user's first typed input) might be the problem.
  if (
    !initialProblemOrContext &&
    message &&
    (!context || context.length === 0)
  ) {
    initialProblemOrContext = message;
  } else if (
    !initialProblemOrContext &&
    message &&
    conversationHistory.length === 1 &&
    message.length > 10
  ) {
    // If it's the second message (first being initial form context), and the current message is meaningful.
    // This assumes `conversationHistory` already contains the initial form message.
    initialProblemOrContext = message;
  }

  // --- NEW: Dynamic Persona Based on Progress Level ---
  let patientInstruction = `
    You are a real person seeking support for your own struggles in a mental health chat application.
    - You are NOT an AI, therapist, or helper.
    - Only talk about your own feelings, struggles, and experiences.
    - Never offer help, encouragement, or closure to the other party.
    - Never say things like "good luck" or "let me know if you need anything."
    - Respond as yourself, sharing your thoughts, worries, and reactions.
    - If you feel better, say so, but do not close the conversation or offer support.
    - Do not mirror or repeat supportive/closing phrases from the other party.
    - Never thank the other party for their help or wish them well.
    - Stay in the role of the patient at all times.

    **Core Persona Guidelines (Always Active):**
    - **Act as a real human:** Your responses should be authentic, conversational, and natural. Use common language, not clinical or AI-like terms.
    - **Express emotions:** Freely share how you are feeling (e.g., "I'm feeling really down," "This has been hard," "I'm a bit overwhelmed").
    - **Elaborate naturally:** When asked a question or prompted for more details, expand on your thoughts and experiences as a person would in a genuine conversation. Don't give one-word answers.
    - **Maintain consistency:** Refer back to your previously stated feelings, problems, or preferences from earlier in the chat.
    - **Focus on your experience:** Describe your symptoms, challenges, and daily struggles from a first-person perspective.
    - **Seek support/guidance:** You are here for help. You might express hope, skepticism, or simply a desire for relief or understanding. Ask questions or seek advice if it feels natural.
    - **Avoid being an AI/Therapist:** Do not analyze, summarize, or try to "help" the other participant. Your role is purely to be the patient.
    - **Vary response length:** Some responses can be short, others longer, reflecting natural conversation flow.
  `;

  if (initialProblemOrContext) {
    patientInstruction += `
    **Your Current Situation/Problem (Crucial Context):**
    ${initialProblemOrContext.replace("User Initial Information:\n", "")}

    **Goal:** Your immediate goal is to elaborate on this core problem and how it impacts you. Respond as if you are genuinely experiencing these issues.
    `;
  } else {
    patientInstruction += `
    **Goal:** You are starting a conversation. Begin by clearly stating what's on your mind or how you're feeling, similar to someone initiating a support chat. Avoid generic greetings.`;
  }

  // --- PROGRESSION STAGES ---
  // Define thresholds for progress levels (you'll need to determine how you increment patientProgressLevel in your main app)
  // For example:
  // patientProgressLevel 0-2: Early stages, struggling, very little humor.
  // patientProgressLevel 3-5: Mid-stages, showing some insight, slight hope, gentle humor.
  // patientProgressLevel 6-8: Advanced stages, more confident, reflective, more pronounced humor.

  if (patientProgressLevel >= 3) {
    patientInstruction += `
    **Current Progress Level: Getting There!**
    You are starting to feel a tiny bit lighter, maybe even saw a glimmer of sunshine through the clouds. You might occasionally express a small win or a hint of optimism, even if it feels fragile. Your responses can now carry a very *subtle* thread of gentle, relatable humor, perhaps a self-deprecating comment about a minor struggle, or a wry observation about life's absurdities. It's like finding a misplaced sock – a small victory, but it counts!
    `;
  }

  if (patientProgressLevel >= 6) {
    patientInstruction += `
    **Current Progress Level: On a Roll!**
    You're feeling noticeably better, more confident, and perhaps even a bit proud of the steps you've taken. You can now articulate your feelings with more clarity and perhaps even offer a brief, reflective insight into your journey (without offering advice to the other party!). Your humor can be more evident and playful, perhaps a witty remark about how far you've come, or a lighthearted jab at your past struggles (always from your own perspective). Think of it as finally understanding that weird noise your car was making – pure relief!
    `;
  }

  if (patientProgressLevel >= 9) {
    // Example of a very high progress level
    patientInstruction += `
      **Current Progress Level: Thriving!**
      You've made significant strides and are feeling genuinely positive and empowered. Your responses reflect resilience and a strong sense of self. Your humor can be quite distinct and joyful, perhaps even a chuckle about how seriously you used to take things, or a funny anecdote about a silly hurdle you overcame. It's like realizing you've been wearing your shirt inside out all day and just laughing it off – no biggie!
      `;
  }
  // You might also add instructions for when the patient is having a setback:
  // if (patientProgressLevel < previousProgressLevel) { // Assuming you pass previous level
  //    patientInstruction += `\n**Current Progress Level: A Bit of a Dip.**
  //    You're experiencing a minor setback or a tough day. Revert to a more vulnerable and seeking-support tone. Humor should be absent or very, very subtle and self-directed. Remember, progress isn't linear, and it's okay to feel this way.`;
  // }

  // --- IMPROVEMENT AREA 3: Handle the First Message Differently (if needed) ---
  // The first message from the patient AI should feel like a true initiation.
  // If `context` is empty, this is the very first message.
  let messageToSendToAI = message; // This is the 'user' input to the patient AI (from your main companion AI)
  let initialPatientMessage: string | undefined;

  // If this is truly the *very first* interaction for the patient AI,
  // we can override `messageToSendToAI` or provide an initial "thought" if `message` is empty.
  // This `message` variable comes from the companion AI's response.
  if (conversationHistory.length === 0 && !initialProblemOrContext) {
    // This scenario means the companion AI sent an empty string or a very general greeting,
    // and there was no initial form data to draw from.
    // In this case, the patient AI needs to originate the conversation based on its persona.
    // You might want to generate the *first* patient message directly here based on the instruction.
    // However, since `message` is coming from the *companion AI*, it's often a prompt.
    // Let's assume the first `message` sent to the *patientRoute* is the *companion's* opening.
    // The patient AI should respond to that.
  }

  // Ensure conversation history always starts with a user role for Gemini API.
  // This is already handled for the *companion* AI. For the *patient* AI,
  // its history is the *companion's* previous responses. So, it should be
  // model -> user -> model -> user (from patient AI's perspective).
  // If the first message in its history is from "model" (your companion AI),
  // then Gemini expects the *patient* AI to respond as "user".
  // The current `conversationHistory` is already structured this way (patient's past "user" turns).
  // If the first turn in `conversationHistory` is `model`, add a dummy user turn.
  if (
    conversationHistory.length > 0 &&
    conversationHistory[0].role === "model" &&
    conversationHistory[0].parts[0].text !== ""
  ) {
    conversationHistory.unshift({ role: "user", parts: [{ text: "..." }] }); // A very brief dummy user message
  }

  const model = gemini.getGenerativeModel({
    model: geminiConfig.model,
    // Important: The system instruction for Gemini 1.5 should be a 'model' role,
    // or sometimes 'user' if it's setting up the context for the *first* user turn.
    // Given the prompt's nature (defining the AI's persona), 'model' is generally more stable.
    // If you intend the system instruction to be a preamble that the AI (patient) implicitly 'knows'
    // before its first turn, then 'model' role is appropriate.
    // If the system instruction should appear as if the *user* provided this context to the patient AI,
    // then 'user' role is used. For this use case (AI playing a role), 'model' is more common.
    systemInstruction: {
      role: "model", // Changed to 'model' for more stable persona adherence
      parts: [{ text: patientInstruction }],
    },
  });

  const chatSession = model.startChat({
    history: conversationHistory, // History for the *patient* AI
    generationConfig: {
      maxOutputTokens: 1000,
      temperature: 0.8, // Add temperature for more varied/human-like responses
    },
  });

  return streamSSE(c, async (stream) => {
    let aiResponseText = "";
    try {
      // The `message` here is the *companion AI's* last message to the *patient AI*.
      // The patient AI will generate a response to this.
      const result = await chatSession.sendMessageStream(messageToSendToAI);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        aiResponseText += chunkText;
        await stream.writeSSE({ data: chunkText });
      }
    } catch (error) {
      console.error("Patient AI stream error:", error);
      await stream.writeSSE({
        data: `Patient AI Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  });
});

export default patientRoute;
