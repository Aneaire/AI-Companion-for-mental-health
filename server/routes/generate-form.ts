import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { Hono } from "hono";
import path from "path";
import { z } from "zod";
import { geminiConfig } from "../lib/config";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function logSystemInstructionText(systemInstructionText: string) {
  try {
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:T]/g, "-")
      .replace(/\..+/, "");
    const logDir = path.join(process.cwd(), "server_logs", "generate-form");
    const logFile = path.join(logDir, `generate-form-${timestamp}.txt`);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.writeFileSync(logFile, systemInstructionText, "utf8");
  } catch (logErr) {
    console.error("Failed to log systemInstructionText:", logErr);
  }
}

const generateFormRoute = new Hono().post("/", async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    initialForm: z.record(z.any()),
    messages: z.array(z.object({ sender: z.string(), text: z.string() })),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error }, 400);
  }
  const { initialForm, messages } = parsed.data;
  // console.log("Check form", initialForm);
  // console.log("Check messages", messages);
  // Compose a prompt for Gemini
  const prompt = `You are an AI assistant tasked with generating personalized questions for a therapy session form.

**Context:**
- Initial Form Data: ${JSON.stringify(initialForm, null, 2)}
- Previous Session Messages: ${messages
    .map((m) => `${m.sender}: ${m.text}`)
    .join("\n")}

**Task:**
Based on the initial form data and conversation history, generate 3-5 relevant questions that would be helpful for the next therapy session. These questions should:
1. Build upon the previous conversation
2. Address any new concerns or progress
3. Help the therapist understand the client's current state
4. Be personalized to the client's specific situation

**Requirements:**
- Questions should be empathetic and supportive
- Focus on the client's emotional state and progress
- Consider any patterns or themes from the conversation
- Make questions specific to the client's situation

**Output Format:**
Return a JSON array of question objects with this structure:
[
  {
    "type": "text|textarea|select",
    "label": "Question text here",
    "name": "uniqueFieldName",
    "options": ["option1", "option2"] // only for select type
  }
]

**Example Question Types:**
- "text": Short text input
- "textarea": Longer text area for detailed responses
- "select": Multiple choice with options

Generate the questions now:`;

  const systemInstructionText = prompt;

  try {
    const model = gemini.getGenerativeModel({
      model: geminiConfig.twoPoint5FlashLite,
      systemInstruction: {
        role: "model",
        parts: [{ text: systemInstructionText }],
      },
    });
    const result = await model.generateContent("");
    // Try to extract the JSON array from the response
    const text =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let questions: any[] = [];
    try {
      // Try to find the first JSON array in the text
      const match = text.match(/\[.*\]/s);
      if (match) {
        questions = JSON.parse(match[0]);
      } else {
        questions = JSON.parse(text);
      }
    } catch (e) {
      // fallback: return the raw text
      questions = [
        { type: "text", label: "(Could not parse questions)", name: "error" },
      ];
    }
    return c.json({ success: true, questions, raw: text });
  } catch (error) {
    console.error("Error generating session form questions:", error);
    return c.json(
      { success: false, error: "Failed to generate questions" },
      500
    );
  }
});

export default generateFormRoute;
