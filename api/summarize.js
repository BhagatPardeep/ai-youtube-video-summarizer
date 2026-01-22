import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const url = req.query.url;

    if (!url) {
      return res.json({ error: "YouTube URL required" });
    }

    // 1. Get transcript
    const transcript = await YoutubeTranscript.fetchTranscript(url);

    if (!transcript || transcript.length === 0) {
      return res.json({ error: "No captions available for this video" });
    }

    const text = transcript.map(t => t.text).join(" ").slice(0, 8000);

    // 2. Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      `Summarize this YouTube video clearly:\n\n${text}`
    );

    return res.json({
      success: true,
      summary: result.response.text()
    });

  } catch (err) {
    return res.json({
      error: err.message
    });
  }
}
