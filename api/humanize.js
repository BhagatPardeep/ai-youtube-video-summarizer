import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {

  // ✅ CORS (Blogger safe)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { text, mode = "human" } = req.query;
    if (!text) {
      return res.json({ error: "Text is required" });
    }

    let instruction = "";
    if (mode === "professional") {
      instruction =
        "Rewrite this content in a professional, formal, and natural human tone. Avoid AI patterns.";
    } else if (mode === "simple") {
      instruction =
        "Rewrite this content in very simple, easy English that sounds human and natural.";
    } else {
      instruction =
        "Rewrite this content to sound fully human, natural, and AdSense-safe. Remove robotic AI tone.";
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      `${instruction}\n\nCONTENT:\n${text}`
    );

    return res.json({
      success: true,
      output: result.response.text()
    });

  } catch (err) {
    return res.json({
      error: "Unable to process content right now."
    });
  }
}
