import express from "express";
import puppeteerService from "../services/puppeteerService.js";

const router = express.Router();

// Get browser status
router.get("/status", async (req, res) => {
  try {
    const status = await puppeteerService.getBrowserStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually open browser
router.post("/open", async (req, res) => {
  try {
    await puppeteerService.initialize();
    const status = await puppeteerService.getBrowserStatus();
    res.json({
      success: true,
      message: "Browser opened successfully",
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Close browser
router.post("/close", async (req, res) => {
  try {
    await puppeteerService.close();
    res.json({
      success: true,
      message: "Browser closed successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
