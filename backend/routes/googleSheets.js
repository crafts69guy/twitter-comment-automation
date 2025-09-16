import express from "express";
import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// Extract sheet ID from Google Sheets URL
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Fetch posts from Google Sheets
router.post("/fetch", async (req, res) => {
  try {
    const { sheetUrl } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({
        message: "Google Sheet URL is required",
      });
    }

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      return res.status(400).json({
        message: "Invalid Google Sheet URL format",
      });
    }

    // Real Google Sheets integration using Service Account
    const auth = new google.auth.GoogleAuth({
      keyFile:
        process.env.GOOGLE_SERVICE_ACCOUNT_PATH || "./google-credentials.json",
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "A:B", // Column A for URLs, Column B for content (optional)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        posts: [],
        message: "No data found in the spreadsheet",
      });
    }

    // Skip header row and process data
    const dataRows = rows.slice(1);
    const posts = dataRows
      .map((row) => ({
        id: uuidv4(),
        url: row[0] || "",
        content: row[1] || "", // Optional pre-filled content
        comment: "",
        status: "pending",
      }))
      .filter(
        (post) =>
          post.url &&
          (post.url.includes("twitter.com") || post.url.includes("x.com")),
      );

    // Store posts in session
    req.userSession.posts = posts;

    res.json({
      success: true,
      posts,
      message: `Fetched ${posts.length} posts from Google Sheets`,
    });
  } catch (error) {
    console.error("Google Sheets fetch error:", error);
    res.status(500).json({
      message: "Failed to fetch posts from Google Sheets",
      error: error.message,
    });
  }
});

export default router;

