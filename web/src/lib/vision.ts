import { ollamaChat } from "./ollama";

// Read env at call-time so tests + dynamic toggles work.
function isStubbed(): boolean {
  const v = process.env.STUB_VISION;
  return v === "true" || v === "1";
}

export interface SurveyExtraction {
  patient_initials?: string;
  visit_date?: string;
  rating_overall?: number;
  rating_communication?: number;
  rating_pain_management?: number;
  free_text_feedback?: string;
  note?: string;
}

const STUB_RESPONSE: SurveyExtraction = {
  patient_initials: "M.Y.",
  visit_date: "2026-04-22",
  rating_overall: 8,
  rating_communication: 9,
  rating_pain_management: 7,
  free_text_feedback: "Nurse was kind. Wait was long but care was good.",
  note: "STUB extraction — STUB_VISION=true. Real Gemma 4 vision call runs on the Mac Mini.",
};

const SYSTEM = `You are a vision extractor for handwritten patient experience surveys at a Critical Access Hospital. Read the form. Return JSON with these fields when present (omit otherwise): patient_initials, visit_date (YYYY-MM-DD), rating_overall (1-10), rating_communication (1-10), rating_pain_management (1-10), free_text_feedback. Do not invent values you cannot read.`;

export async function extractSurveyFromImage(base64Image: string): Promise<SurveyExtraction> {
  if (isStubbed()) return STUB_RESPONSE;

  // Per Gemma 4 docs, the multimodal pipeline expects images on Ollama's
  // `images` array (not embedded in content text). The model sees the image
  // before the prompt text — Google's published guidance is to place visual
  // content first.
  const res = await ollamaChat({
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          "Extract the fields from this handwritten patient experience survey. Respond with JSON only.",
        images: [base64Image],
      },
    ],
  });

  const text = res.message.content?.trim() ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { note: `vision call returned no JSON: ${text.slice(0, 200)}` };
  try {
    return JSON.parse(jsonMatch[0]) as SurveyExtraction;
  } catch (e) {
    return { note: `vision JSON parse failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
