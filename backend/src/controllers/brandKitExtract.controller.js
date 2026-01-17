/**
 * =============================================================================
 * BrandGuard AI - Brand Kit Extraction Controller
 * =============================================================================
 *
 * Extracts brand information from uploaded brand kit files (images/PDFs)
 * Uses Gemini Vision API to analyze and extract:
 * - Color palette
 * - Typography/fonts
 * - Logo guidelines
 * - Brand tone and voice
 */

import BrandKit from "../models/BrandKit.js";
import geminiService from "../services/gemini.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Extract brand kit from uploaded file using AI
 *
 * @route POST /api/brandkit/extract
 * @body {string} fileName - Name of the uploaded file
 * @body {string} fileType - MIME type of the file
 * @body {string} fileData - Base64 encoded file data
 */
export const extractBrandKit = async (req, res, next) => {
  try {
    const { fileName, fileType, fileData, extractColors = true, extractFonts = true } = req.body;

    if (!fileName || !fileData) {
      return res.status(400).json(errorResponse("File name and data are required"));
    }

    logger.info(`Extracting brand kit from file: ${fileName}`);

    // Analyze image with Gemini Vision
    const prompt = `Analyze this brand kit image and extract brand guidelines. Provide a JSON response with:

1. colors: Array of brand colors with format:
   [{ "name": "Primary Blue", "hex": "#0066CC", "usage": "primary" }]
   Extract ALL visible colors from the image. For each color provide a descriptive name and hex code.

2. fonts: Array of fonts with format:
   [{ "name": "Arial", "usage": "heading" }]
   Identify any visible fonts or typography. If you can't identify specific fonts, suggest professional alternatives.

3. logoInfo: Object with logo details:
   { "hasLogo": true, "description": "Description of logo", "colors": ["#hex1", "#hex2"] }

4. brandDescription: Brief description of the brand's visual identity

Format your response as valid JSON only, no markdown or explanations.`;

    let extractedData;
    try {
      // Use Gemini to analyze the brand kit image
      const analysis = await geminiService.analyzeImageWithPrompt(
        fileData,
        fileType,
        prompt
      );

      // Parse Gemini's response
      extractedData = JSON.parse(analysis);
      logger.info("Brand data extracted successfully via Gemini");
    } catch (parseError) {
      logger.warn("Failed to parse Gemini response, using fallback extraction");
      // Fallback: Create basic brand kit if AI fails
      extractedData = {
        colors: [
          { name: "Primary", hex: "#000000", usage: "primary" },
          { name: "Secondary", hex: "#FFFFFF", usage: "secondary" },
        ],
        fonts: [
          { name: "Inter", usage: "body" },
          { name: "Helvetica", usage: "heading" },
        ],
        brandDescription: `Brand kit from ${fileName}`,
      };
    }

    // Format colors with all required fields
    const validColorUsages = ["primary", "secondary", "accent", "background", "text", "any"];
    const formattedColors = (extractedData.colors || []).map((color) => {
      // Map custom usage to valid enum values
      let usage = "any";
      if (color.usage) {
        const lowerUsage = color.usage.toLowerCase();
        if (lowerUsage.includes("primary")) usage = "primary";
        else if (lowerUsage.includes("secondary")) usage = "secondary";
        else if (lowerUsage.includes("accent") || lowerUsage.includes("highlight")) usage = "accent";
        else if (lowerUsage.includes("background") || lowerUsage.includes("neutral")) usage = "background";
        else if (lowerUsage.includes("text") || lowerUsage.includes("body")) usage = "text";
      }
      
      return {
        name: color.name || "Unnamed Color",
        hex: color.hex,
        tolerance: 10,
        usage: usage,
      };
    });

    // Format fonts with all required fields
    const validFontUsages = ["heading", "body", "accent", "any"];
    const formattedFonts = (extractedData.fonts || []).map((font) => {
      // Map custom usage to valid enum values
      let usage = "any";
      if (font.usage) {
        const lowerUsage = font.usage.toLowerCase();
        if (lowerUsage.includes("heading") || lowerUsage.includes("display") || lowerUsage.includes("title")) usage = "heading";
        else if (lowerUsage.includes("body") || lowerUsage.includes("text") || lowerUsage.includes("paragraph")) usage = "body";
        else if (lowerUsage.includes("accent")) usage = "accent";
      }
      
      return {
        name: font.name || "System Font",
        fallbacks: ["Arial", "sans-serif"],
        usage: usage,
        weights: [400, 700],
      };
    });

    // Truncate description to 500 characters
    const description = extractedData.brandDescription
      ? extractedData.brandDescription.substring(0, 480) + "..."
      : `Brand kit extracted from ${fileName}`;

    // Create brand kit with extracted data
    const brandKitData = {
      name: `Extracted: ${fileName}`.substring(0, 100),
      description: description,
      colors: formattedColors,
      fonts: formattedFonts,
      logoRules: {
        minWidth: 100,
        minHeight: 100,
        clearSpace: 20,
        allowedBackgrounds: ["#FFFFFF", "#000000"], // Use hex colors instead of "light", "dark"
        prohibitedUses: ["stretching", "rotating"],
      },
      accessibility: {
        minContrastRatio: 4.5,
        largeTextContrastRatio: 3,
        requireAltText: true,
      },
      toneGuidelines: {
        voice: "professional",
        language: "formal",
        prohibitedWords: [],
        preferredPhrases: [],
      },
      version: 1,
      isActive: true,
      sourceFile: fileName,
      extractedViaAI: true,
    };

    // Save to database
    const brandKit = new BrandKit(brandKitData);
    await brandKit.save();

    logger.info(`Brand kit created from extraction: ${brandKit._id} - ${brandKit.name}`);

    res.status(201).json(
      successResponse(
        { brandKit, extractedData },
        "Brand kit extracted and created successfully"
      )
    );
  } catch (error) {
    logger.error("Brand kit extraction error:", error);
    next(error);
  }
};
