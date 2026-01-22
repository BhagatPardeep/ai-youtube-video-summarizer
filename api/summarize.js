import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {

  // ✅ CORS (required for Blogger)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { url, lang = "en", check } = req.query;
    if (!url) return res.json({ error: "YouTube URL required" });

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

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    /* ===============================
       2️⃣ TRY TRANSCRIPT FIRST
    =============================== */
    let transcript = null;

    try {
      transcript = await YoutubeTranscript.fetchTranscript(url, { lang });
    } catch {}

    if (transcript && transcript.length > 0) {
      const text = transcript.map(t => t.text).join(" ").slice(0, 8000);

      const prompt = `Summarize this YouTube video in ${lang}:\n\n${text}`;
      const result = await model.generateContent(prompt);

      return res.json({
        success: true,
        mode: "transcript",
        summary: result.response.text()
      });
    }

    /* ===============================
       3️⃣ FALLBACK: TITLE-BASED SUMMARY
    =============================== */
    const oembedUrl =
      "https://www.youtube.com/oembed?format=json&url=" +
      encodeURIComponent(url);

    const metaRes = await fetch(oembedUrl);
    if (!metaRes.ok) {
      return res.json({
        error: "Captions not available and video metadata could not be fetched."
      });
    }

    const meta = await metaRes.json();
    const title = meta.title || "Unknown video";

    const fallbackPrompt = `
The YouTube video titled "${title}" does not have accessible captions.
Based only on the title, generate a helpful high-level summary of what this video is likely about.
Do NOT hallucinate specific events. Keep it general and informative.
    `;

    const fallbackResult = await model.generateContent(fallbackPrompt);

    return res.json({
      success: true,
      mode: "fallback",
      summary: fallbackResult.response.text()
    });

  } catch (err) {
    return res.json({
      error: "Unable to summarize this video right now."
    });
  }
}
