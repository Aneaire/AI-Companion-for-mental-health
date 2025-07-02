import { GoogleGenerativeAI } from "@google/generative-ai";
import { Hono } from "hono";
import { geminiConfig } from "server/lib/config";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const progressRoute = new Hono().post("/", async (c) => {
  const body = await c.req.json();
  const { context } = body;

  // Prepare conversation history as plain text
  const conversation = (context || [])
    .map(
      (msg: any) =>
        `${msg.role === "model" ? "Companion" : "Patient"}: ${msg.text}`
    )
    .join("\n");

  const prompt = `
You are an expert at evaluating mental health progress in chat conversations.

Given the following conversation between a patient and a companion, rate the patient's current progress on a scale from 0 to 10, where:
- 0 = extremely struggling, hopeless, or in crisis
- 2 = very low, feeling stuck, little hope
- 4 = some insight, but still mostly struggling
- 6 = making progress, some hope, occasional positive moments
- 8 = mostly positive, confident, resilient, but not perfect
- 10 = thriving, empowered, optimistic, and self-sufficient

First, return a single integer (0-10) for the progress level on the first line.
Then, on the next line, provide a one-sentence rationale for your rating, referencing the patient's recent statements or overall tone.

Conversation:
${conversation}
`;

  const model = gemini.getGenerativeModel({
    model: geminiConfig.model,
  });

  const result = await model.generateContent(prompt);
  const text = await result.response.text();
  // Extract the first integer 0-10 from the response and the rationale
  const match = text.match(/\b([0-9]|10)\b/);
  const progress = match ? parseInt(match[1], 10) : 0;
  // Rationale: everything after the first line
  const rationale = text.split("\n").slice(1).join(" ").trim();

  return c.json({ progress, rationale });
});

export default progressRoute;
