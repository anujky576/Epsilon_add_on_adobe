/**
 * =============================================================================
 * BrandGuard AI - Gemini AI Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service is the CORE of the AI-powered brand analysis. It:
 * 1. Manages the Google Gemini API client
 * 2. Generates structured prompts for brand compliance analysis
 * 3. Parses AI responses into deterministic JSON
 * 4. Provides mock mode for development without API key
 *
 * GEMINI INTEGRATION STRATEGY:
 * - Real Gemini API structure is used throughout
 * - Mock mode returns realistic responses for hackathon demo
 * - Switching between mock and real is a single environment variable
 *
 * PROMPT ENGINEERING:
 * The prompts are carefully crafted to ensure:
 * - Consistent, parseable JSON output
 * - Specific violation detection with severity levels
 * - Actionable suggestions for fixes
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------
const getUseMockAI = () => process.env.USE_MOCK_AI === "true";
const getGeminiApiKey = () => process.env.GEMINI_API_KEY;

// Lazy-loaded Gemini client (initialized on first use)
let genAI = null;
let model = null;
let initAttempted = false;

/**
 * Initialize Gemini client (lazy - called on first use)
 * This ensures env vars are loaded before init
 */
function initializeGemini() {
  if (initAttempted) return !!model;
  initAttempted = true;

  const useMock = getUseMockAI();
  const apiKey = getGeminiApiKey();

  logger.info(
    `Gemini Init - Mock: ${useMock}, HasKey: ${!!apiKey}, KeyLen: ${
      apiKey?.length || 0
    }`
  );

  if (useMock) {
    logger.info("🤖 Gemini AI running in MOCK mode");
    return false;
  }

  if (!apiKey) {
    logger.warn("⚠️ No GEMINI_API_KEY found - using mock mode");
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    logger.info("✅ Gemini AI client initialized successfully");
    return true;
  } catch (error) {
    logger.error("❌ Failed to initialize Gemini AI:", error.message);
    return false;
  }
}

/**
 * Get the Gemini model (initializes on first call)
 */
function getModel() {
  initializeGemini();
  return model;
}

// ---------------------------------------------------------------------------
// PROMPT TEMPLATES
// ---------------------------------------------------------------------------

/**
 * Main analysis prompt template
 * CRITICAL: This prompt structure is designed for consistent JSON output
 */
const ANALYSIS_PROMPT_TEMPLATE = `
You are a brand compliance expert. Analyze the following design against the brand guidelines and provide a detailed compliance report.

## Brand Kit (Guidelines to follow):
\`\`\`json
{BRAND_KIT}
\`\`\`

## Design to Analyze:
\`\`\`json
{DESIGN}
\`\`\`

## Instructions:
1. Compare each element of the design against the brand guidelines
2. Identify ALL violations, no matter how minor
3. Calculate a compliance score (0-100) based on:
   - Color matching: 30% weight
   - Typography: 25% weight  
   - Logo usage: 20% weight
   - Accessibility: 15% weight
   - Tone/Language: 10% weight
4. For each violation, provide a specific, actionable fix

## Required JSON Output Format:
{
  "complianceScore": <number 0-100>,
  "summary": "<brief 1-2 sentence summary>",
  "categoryScores": {
    "color": <number 0-100>,
    "typography": <number 0-100>,
    "logo": <number 0-100>,
    "accessibility": <number 0-100>,
    "tone": <number 0-100>
  },
  "violations": [
    {
      "type": "<color|font|logo|accessibility|tone|spacing|layout>",
      "severity": "<critical|high|medium|low>",
      "description": "<clear description of the violation>",
      "affectedElement": "<the specific element causing the violation>",
      "suggestedFix": "<specific fix recommendation>",
      "autoFixable": <true|false>
    }
  ]
}

Respond ONLY with valid JSON, no additional text.
`;

/**
 * Tone analysis prompt template
 */
const TONE_ANALYSIS_PROMPT = `
Analyze the following text content for brand tone compliance.

## Brand Tone Guidelines:
- Style: {STYLE}
- Banned words: {BANNED_WORDS}

## Text to Analyze:
"{TEXT}"

## Instructions:
1. Check if the tone matches the required style
2. Identify any banned words used
3. Evaluate overall messaging appropriateness

## Required JSON Output:
{
  "toneMatch": <true|false>,
  "detectedTone": "<detected tone style>",
  "bannedWordsFound": ["<list of found banned words>"],
  "violations": [
    {
      "type": "tone",
      "severity": "<high|medium|low>",
      "description": "<description>",
      "affectedElement": "<the problematic text>",
      "suggestedFix": "<suggested alternative>"
    }
  ]
}

Respond ONLY with valid JSON.
`;

// ---------------------------------------------------------------------------
// MOCK RESPONSES
// ---------------------------------------------------------------------------

/**
 * Generate mock analysis response for development
 * DESIGN DECISION: Mock responses are realistic and follow the exact
 * same structure as real Gemini responses for seamless switching
 */
const generateMockAnalysis = (brandKit, design) => {
  // Simulate different scenarios based on design data
  const colorsUsed = design.colorsUsed || [];
  const fontsUsed = design.fontsUsed || [];
  const brandColors = brandKit.colors?.map((c) => c.hex.toLowerCase()) || [];
  const brandFonts = brandKit.fonts?.map((f) => f.name.toLowerCase()) || [];

  const violations = [];
  let colorScore = 100;
  let fontScore = 100;
  let logoScore = 100;
  let accessibilityScore = 100;
  let toneScore = 100;

  // Check colors
  colorsUsed.forEach((color) => {
    const normalizedColor = color.toLowerCase();
    if (!brandColors.includes(normalizedColor)) {
      // Find closest brand color for suggestion
      const suggestedColor = brandColors[0] || "#000000";
      violations.push({
        type: "color",
        severity: "high",
        description: `Color ${color} is not in the approved brand palette`,
        affectedElement: color,
        suggestedFix: suggestedColor,
        autoFixable: true,
      });
      colorScore -= 20;
    }
  });

  // Check fonts
  fontsUsed.forEach((font) => {
    const normalizedFont = font.toLowerCase();
    if (!brandFonts.includes(normalizedFont)) {
      const suggestedFont = brandFonts[0] || "Arial";
      violations.push({
        type: "font",
        severity: "medium",
        description: `Font "${font}" is not in the approved brand typography`,
        affectedElement: font,
        suggestedFix: suggestedFont,
        autoFixable: true,
      });
      fontScore -= 25;
    }
  });

  // Check logo if present
  const logos = design.images?.filter((img) => img.type === "logo") || [];
  logos.forEach((logo) => {
    const minWidth = brandKit.logoRules?.minWidth || 50;
    const minHeight = brandKit.logoRules?.minHeight || 50;

    if (logo.width < minWidth || logo.height < minHeight) {
      violations.push({
        type: "logo",
        severity: "high",
        description: `Logo dimensions (${logo.width}x${logo.height}) are below minimum required (${minWidth}x${minHeight})`,
        affectedElement: { width: logo.width, height: logo.height },
        suggestedFix: { width: minWidth, height: minHeight },
        autoFixable: false,
      });
      logoScore -= 30;
    }
  });

  // Check accessibility (simplified)
  if (design.textContent && design.textContent.length > 0) {
    const smallText = design.textContent.filter(
      (t) => t.fontSize && t.fontSize < 12
    );
    if (smallText.length > 0) {
      violations.push({
        type: "accessibility",
        severity: "medium",
        description: "Some text elements are too small for comfortable reading",
        affectedElement: `${smallText.length} text element(s) below 12px`,
        suggestedFix: "Increase font size to at least 12px",
        autoFixable: true,
      });
      accessibilityScore -= 15;
    }
  }

  // Check for banned words
  const allText =
    design.textContent
      ?.map((t) => t.text)
      .join(" ")
      .toLowerCase() || "";
  const bannedWords = brandKit.toneRules?.bannedWords || [];
  const foundBanned = bannedWords.filter((word) =>
    allText.includes(word.toLowerCase())
  );

  if (foundBanned.length > 0) {
    violations.push({
      type: "tone",
      severity: "critical",
      description: `Text contains banned words: ${foundBanned.join(", ")}`,
      affectedElement: foundBanned,
      suggestedFix: "Remove or replace banned words",
      autoFixable: false,
    });
    toneScore -= 40;
  }

  // Ensure scores don't go below 0
  colorScore = Math.max(0, colorScore);
  fontScore = Math.max(0, fontScore);
  logoScore = Math.max(0, logoScore);
  accessibilityScore = Math.max(0, accessibilityScore);
  toneScore = Math.max(0, toneScore);

  // Calculate weighted overall score
  const complianceScore = Math.round(
    colorScore * 0.3 +
      fontScore * 0.25 +
      logoScore * 0.2 +
      accessibilityScore * 0.15 +
      toneScore * 0.1
  );

  // Generate summary
  let summary;
  if (complianceScore >= 90) {
    summary =
      "Excellent brand compliance. The design follows brand guidelines with minimal deviations.";
  } else if (complianceScore >= 70) {
    summary = "Good brand compliance with some minor issues to address.";
  } else if (complianceScore >= 50) {
    summary =
      "Design needs attention. Multiple brand guideline violations detected.";
  } else {
    summary =
      "Significant brand compliance issues found. Major revisions recommended.";
  }

  return {
    complianceScore,
    summary,
    categoryScores: {
      color: colorScore,
      typography: fontScore,
      logo: logoScore,
      accessibility: accessibilityScore,
      tone: toneScore,
    },
    violations,
  };
};

/**
 * Generate mock tone analysis
 */
const generateMockToneAnalysis = (text, style, bannedWords) => {
  const lowerText = text.toLowerCase();
  const foundBanned = bannedWords.filter((word) =>
    lowerText.includes(word.toLowerCase())
  );

  return {
    toneMatch: foundBanned.length === 0,
    detectedTone: style,
    bannedWordsFound: foundBanned,
    violations: foundBanned.map((word) => ({
      type: "tone",
      severity: "high",
      description: `Banned word "${word}" found in text`,
      affectedElement: word,
      suggestedFix: "Remove or replace with appropriate alternative",
    })),
  };
};

// ---------------------------------------------------------------------------
// SERVICE METHODS
// ---------------------------------------------------------------------------

/**
 * Run comprehensive brand analysis using Gemini AI
 *
 * @param {Object} brandKit - The brand kit to check against
 * @param {Object} design - The design to analyze
 * @returns {Promise<Object>} Analysis results with score and violations
 */
export const runBrandAnalysis = async (brandKit, design) => {
  const startTime = Date.now();

  logger.info(
    `Running brand analysis for design: ${design.canvasId || design._id}`
  );

  try {
    // Get model (initializes lazily)
    const geminiModel = getModel();

    // Use mock in development or if Gemini is not configured
    if (getUseMockAI() || !geminiModel) {
      logger.info("Using mock AI for analysis");
      const result = generateMockAnalysis(brandKit, design);
      result.processingTime = Date.now() - startTime;
      result.usedAI = false;
      return result;
    }

    // Build the prompt with actual data
    const prompt = ANALYSIS_PROMPT_TEMPLATE.replace(
      "{BRAND_KIT}",
      JSON.stringify(
        brandKit.toAnalysisPrompt ? brandKit.toAnalysisPrompt() : brandKit,
        null,
        2
      )
    ).replace(
      "{DESIGN}",
      JSON.stringify(
        design.toAnalysisInput ? design.toAnalysisInput() : design,
        null,
        2
      )
    );

    logger.debug("Sending prompt to Gemini...");

    // Call Gemini API
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      jsonText = text.split("```")[1].split("```")[0].trim();
    }

    const analysisResult = JSON.parse(jsonText);
    analysisResult.processingTime = Date.now() - startTime;
    analysisResult.usedAI = true;

    logger.info(
      `Analysis complete. Score: ${
        analysisResult.complianceScore
      }, Violations: ${analysisResult.violations?.length || 0}`
    );

    return analysisResult;
  } catch (error) {
    logger.error("Gemini analysis failed:", error.message);

    // Fallback to mock on error
    logger.warn("Falling back to mock analysis");
    const result = generateMockAnalysis(brandKit, design);
    result.processingTime = Date.now() - startTime;
    result.usedAI = false;
    result.error = error.message;
    return result;
  }
};

/**
 * Analyze text tone and language
 *
 * @param {string} text - Text content to analyze
 * @param {Object} toneRules - Tone rules from brand kit
 * @returns {Promise<Object>} Tone analysis results
 */
export const analyzeTone = async (text, toneRules) => {
  const style = toneRules.style || "professional";
  const bannedWords = toneRules.bannedWords || [];

  try {
    const geminiModel = getModel();

    if (getUseMockAI() || !geminiModel) {
      return generateMockToneAnalysis(text, style, bannedWords);
    }

    const prompt = TONE_ANALYSIS_PROMPT.replace("{STYLE}", style)
      .replace("{BANNED_WORDS}", bannedWords.join(", "))
      .replace("{TEXT}", text);

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    let jsonText = response.text();

    if (jsonText.includes("```json")) {
      jsonText = jsonText.split("```json")[1].split("```")[0].trim();
    }

    return JSON.parse(jsonText);
  } catch (error) {
    logger.error("Tone analysis failed:", error.message);
    return generateMockToneAnalysis(text, style, bannedWords);
  }
};

/**
 * Check if Gemini service is available
 *
 * @returns {Object} Service status
 */
export const getServiceStatus = () => {
  initializeGemini(); // Ensure initialized
  return {
    available: true,
    mode: getUseMockAI() ? "mock" : "live",
    hasApiKey: !!getGeminiApiKey(),
    modelInitialized: !!model,
  };
};

// Export as service object for consistency
export default {
  runBrandAnalysis,
  analyzeTone,
  getServiceStatus,
};
