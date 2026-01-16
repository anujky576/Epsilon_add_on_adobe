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

/**
 * Main analysis prompt template
 * DETERMINISTIC VERSION - No hallucination, metadata-only analysis
 * A11y = Accessibility (A + 11 letters + y)
 */
const ANALYSIS_PROMPT_TEMPLATE = `
You are BrandGuard AI, a deterministic brand compliance engine.

You analyze ONLY the provided JSON metadata.
You DO NOT assume missing information.
You DO NOT hallucinate visual verification.
You MUST follow scoring rules exactly.
You MUST output valid JSON only.

━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT CAPABILITIES
━━━━━━━━━━━━━━━━━━━━━━
• You CANNOT see images visually
• You CANNOT recognize illustrations, creatures, mascots, or artwork
• Illustrations, characters, animals, or creative elements are NOT violations
• You ONLY evaluate: colors, fonts, text, metadata, dimensions

━━━━━━━━━━━━━━━━━━━━━━
ABSENCE RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━
• Missing logo ≠ violation
• Missing logo → logo score = 0 AND "not evaluated"
• Missing fonts list → typography score = 50 (unknown)
• Missing colorsUsed → color score = 50 (unknown)
• DO NOT invent violations for missing data

━━━━━━━━━━━━━━━━━━━━━━
LOGO RULES (STRICT)
━━━━━━━━━━━━━━━━━━━━━━
IF design.images contains NO item with type="logo":
→ logo.score = 0
→ logo.status = "not_present"
→ NO violation

IF design.images contains type="logo":
→ You MAY check dimensions ONLY
→ You MUST NOT verify brand correctness
→ MAX logo score = 50
→ Always add limitation note

━━━━━━━━━━━━━━━━━━━━━━
COLOR SCORING (0–100)
━━━━━━━━━━━━━━━━━━━━━━
• Neutral colors (white, black, gray) are ALWAYS allowed
• Brand color match = hex exact OR close (±15 RGB distance)

SCORING:
- ≥1 brand color used → base 70
- Each extra matching brand color → +10
- Each off-brand non-neutral color → −15
- No brand colors at all → MAX 40

━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAPHY SCORING
━━━━━━━━━━━━━━━━━━━━━━
• Exact brand font match → 100
• Unknown font → 50
• Explicitly wrong font → 30–50
• DO NOT assume font intent

━━━━━━━━━━━━━━━━━━━━━━
ACCESSIBILITY (A11y) CHECK
━━━━━━━━━━━━━━━━━━━━━━
• fontSize < 12px → violation
• If no text → accessibility = 100

━━━━━━━━━━━━━━━━━━━━━━
TONE RULES
━━━━━━━━━━━━━━━━━━━━━━
• Only check banned words
• Do NOT infer brand personality
• No banned words → 100

━━━━━━━━━━━━━━━━━━━━━━
FINAL SCORE CALCULATION
━━━━━━━━━━━━━━━━━━━━━━
overallScore =
(color * 0.3) +
(typography * 0.25) +
(logo * 0.2) +
(accessibility * 0.15) +
(tone * 0.1)

━━━━━━━━━━━━━━━━━━━━━━
INPUT DATA
━━━━━━━━━━━━━━━━━━━━━━

BRAND_KIT:
{BRAND_KIT}

DESIGN:
{DESIGN}

━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT (JSON ONLY)
━━━━━━━━━━━━━━━━━━━━━━
{
  "designType": "graphic | illustration | text | mixed",
  "complianceScore": number,
  "summary": "factual, short, no opinions",
  "categoryScores": {
    "color": number,
    "typography": number,
    "logo": number,
    "accessibility": number,
    "tone": number
  },
  "violations": [
    {
      "type": "color | font | typography | logo | accessibility | tone | other",
      "severity": "critical | high | medium | low",
      "description": "Clear description of the violation",
      "affectedElement": "The specific element causing the violation (e.g., hex color, font name, text)",
      "suggestedFix": "How to fix it",
      "autoFixable": true | false
    }
  ],
  "positives": [],
  "limitations": [
    "Visual verification not possible",
    "Analysis based on metadata only"
  ]
}

DO NOT include markdown.
DO NOT include explanations.
DO NOT include text outside JSON.
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

  // Helper: Check if color is a neutral (white, black, gray)
  const isNeutralColor = (hex) => {
    const neutral = hex.toLowerCase();
    // Common neutrals that shouldn't be flagged
    const neutrals = [
      "#ffffff",
      "#000000",
      "#fff",
      "#000",
      "#f5f5f5",
      "#e0e0e0",
      "#333333",
      "#666666",
      "#999999",
      "#cccccc",
      "#fafafa",
      "#f0f0f0",
    ];
    if (neutrals.includes(neutral)) return true;

    // Check if it's a gray (R ≈ G ≈ B)
    if (neutral.length === 7) {
      const r = parseInt(neutral.slice(1, 3), 16);
      const g = parseInt(neutral.slice(3, 5), 16);
      const b = parseInt(neutral.slice(5, 7), 16);
      const maxDiff = Math.max(
        Math.abs(r - g),
        Math.abs(g - b),
        Math.abs(r - b)
      );
      if (maxDiff < 15) return true; // It's essentially gray
    }
    return false;
  };

  // Helper: Check if two colors are within tolerance
  const colorsMatch = (color1, color2, tolerance = 15) => {
    const hex1 = color1.toLowerCase().replace("#", "");
    const hex2 = color2.toLowerCase().replace("#", "");
    if (hex1.length !== 6 || hex2.length !== 6) return false;

    const r1 = parseInt(hex1.slice(0, 2), 16);
    const g1 = parseInt(hex1.slice(2, 4), 16);
    const b1 = parseInt(hex1.slice(4, 6), 16);
    const r2 = parseInt(hex2.slice(0, 2), 16);
    const g2 = parseInt(hex2.slice(2, 4), 16);
    const b2 = parseInt(hex2.slice(4, 6), 16);

    const diff = Math.sqrt(
      Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2)
    );
    const maxDiff = Math.sqrt(3 * Math.pow(255, 2)); // Max possible difference
    const percentDiff = (diff / maxDiff) * 100;

    return percentDiff <= tolerance;
  };

  // Check colors with tolerance and neutral awareness
  colorsUsed.forEach((color) => {
    // Skip neutral colors - they're always acceptable
    if (isNeutralColor(color)) return;

    // Check if color matches any brand color within tolerance
    const matchesBrand = brandColors.some((brandColor) =>
      colorsMatch(color, brandColor, 15)
    );

    if (!matchesBrand) {
      const suggestedColor = brandColors[0] || "#000000";
      violations.push({
        type: "color",
        severity: "medium", // Lower severity - might be intentional
        description: `Color ${color} is not close to any brand palette color`,
        affectedElement: color,
        suggestedFix: suggestedColor,
        autoFixable: true,
      });
      colorScore -= 10; // Smaller penalty
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

    // Log violations structure for debugging
    if (analysisResult.violations && analysisResult.violations.length > 0) {
      logger.debug(`Violations structure: ${JSON.stringify(analysisResult.violations[0], null, 2)}`);
    }

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
