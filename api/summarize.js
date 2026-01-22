import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const { url, lang = "en", check } = req.query;

    if (!url) {
      return res.json({ error: "YouTube URL required" });
    }

    /* ===============================
       1️⃣ CHECK CAPTIONS ONLY
    =============================== */
    if (check === "1") {
      try {
        await YoutubeTranscript.fetchTranscript(url);
        return res.json({ captions: true });
      } catch {
        return res.json({ captions: false });
      }
    }

    /* ===============================
       2️⃣ FETCH TRANSCRIPT (SMART)
    =============================== */
    let transcript = null;

    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang });
    } catch {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "en" });
      } catch {
        try {
          transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "hi" });
        } catch {
          try {
            transcript = await YoutubeTranscript.fetchTranscript(url, { lang: "pa" });
          } catch {
            transcript = null;
          }
        }
      }
    }

    if (!transcript || transcript.length === 0) {
      return res.json({
        error:
          "This video shows captions on YouTube, but they are not available for summarization. Please try another video."
      });
    }

    const text = transcript
      .map(t => t.text)
      .join(" ")
      .slice(0, 8000);

    /* ===============================
       3️⃣ AI SUMMARY
    =============================== */
    let langText = "English";
    if (lang === "hi") langText = "Hindi";
    if (lang === "pa") langText = "Punjabi";

    const prompt = `Summarize this YouTube video in ${langText}:\n\n${text}`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);

    return res.json({
      success: true,
      summary: result.response.text()
    });

  } catch (err) {
    return res.json({
      error: "Unable to process this video right now."
    });
  }
}
