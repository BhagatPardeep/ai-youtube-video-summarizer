import { YoutubeTranscript } from "youtube-transcript";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {

  /* ===============================
     CORS (REQUIRED FOR BLOGGER)
  =============================== */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { url, lang = "en", check } = req.query;
    if (!url) return res.json({ error: "YouTube URL required" });

    /* ===============================
       CHECK CAPTIONS ONLY
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
       TRY TRANSCRIPT FIRST
    =============================== */
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url, { lang });

      if (transcript && transcript.length > 0) {
        const text = transcript
          .map(t => t.text)
          .join(" ")
          .slice(0, 8000);

        const result = await model.generateContent(
          `Summarize this YouTube video in ${lang}:\n\n${text}`
        );

        return res.json({
          success: true,
          mode: "transcript",
          summary: result.response.text()
        });
      }
    } catch {
      // continue to fallback
    }

    /* ===============================
       FALLBACK: TITLE-BASED SUMMARY
    =============================== */
    const metaRes = await fetch(
      "https://www.youtube.com/oembed?format=json&url=" +
        encodeURIComponent(url)
    );

    if (!metaRes.ok) {
      return res.json({
        error: "Captions unavailable and metadata could not be fetched."
      });
    }

    const meta = await metaRes.json();
    const title = meta.title || "Unknown video";

    const fallbackResult = await model.generateContent(
      `The YouTube video titled "${title}" does not provide captions.
Generate a general, high-level summary of what this video is likely about.
Do not invent specific facts. Keep it informative and safe.`
    );

    return res.json({
      success: true,
      mode: "fallback",
      summary: fallbackResult.response.text()
    });

  } catch (err) {
    return res.json({
      error: "Unable to summarize this video."
    });
  }
}
