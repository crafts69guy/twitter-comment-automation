import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Option 1: Using API Key (for public sheets)
export async function fetchFromPublicSheet(sheetId, apiKey) {
  const sheets = google.sheets({ version: 'v4', auth: apiKey });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:B', // Column A for URLs, Column B for optional content
    });

    return response.data.values;
  } catch (error) {
    console.error('Error fetching public sheet:', error);
    throw error;
  }
}

// Option 2: Using Service Account (recommended)
export async function fetchFromPrivateSheet(sheetId, serviceAccountPath) {
  // Load service account credentials
  const credentials = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:B', // Column A for URLs, Column B for optional content
    });

    return response.data.values;
  } catch (error) {
    console.error('Error fetching private sheet:', error);
    throw error;
  }
}

// Helper function to extract sheet ID from URL
export function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}