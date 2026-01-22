import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {

  // 🔥 CORS FIX (THIS IS THE MISSING PIECE)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { url, lang = "en", check } = req.query;

    if (!url) {
      return res.json({ error: "YouTube URL required" });
    }

    // 1️⃣ CHECK CAPTIONS ONLY
    if (check === "1") {
      try {
        await YoutubeTranscript.fetchTranscript(url);
        return res.json({ captions: true });
      } catch {
        return res.json({ captions: false });
      }
    }

    // 2️⃣ FETCH TRANSCRIPT WITH FALLBACK
    let transcript = null;

    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang });
    } catch {
      try { transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "en" }); }
      catch {
        try { transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "hi" }); }
        catch {
          try { transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "pa" }); }
          catch { transcript = null; }
        }
      }
    }

    if (!transcript || transcript.length === 0) {
      return res.json({
        error: "This video shows captions on YouTube, but they are not available for summarization."
      });
    }

    const text = transcript.map(t => t.text).join(" ").slice(0, 8000);

    const langMap = { en: "English", hi: "Hindi", pa: "Punjabi" };
    const language = langMap[lang] || "English";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(
      `Summarize this YouTube video in ${language}:\n\n${text}`
    );

    return res.json({
      success: true,
      summary: result.response.text()
    });

  } catch (err) {
    return res.json({
      error: "Server error. Please try another video."
    });
  }
}
