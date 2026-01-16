/**
 * =============================================================================
 * BrandGuard AI - Analysis Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This is the CORE controller that orchestrates brand compliance analysis.
 * It coordinates multiple services to produce a comprehensive compliance report.
 *
 * ANALYSIS FLOW:
 * 1. Fetch brand kit and design
 * 2. Run modular compliance checks (color, font, logo, accessibility, tone)
 * 3. Aggregate results into overall compliance score
 * 4. Save analysis result to database
 * 5. Return scored violations with fix suggestions
 *
 * ENDPOINTS:
 * - POST /api/analysis/run     - Run brand analysis
 * - GET  /api/analysis/:id     - Get analysis result
 * - GET  /api/analysis/history - Get analysis history
 */

import BrandKit from "../models/BrandKit.js";
import Design from "../models/Design.js";
import AnalysisResult from "../models/AnalysisResult.js";
import geminiService from "../services/gemini.service.js";
import colorCheckService from "../services/colorCheck.service.js";
import fontCheckService from "../services/fontCheck.service.js";
import logoCheckService from "../services/logoCheck.service.js";
import accessibilityService from "../services/accessibility.service.js";
import toneCheckService from "../services/toneCheck.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Run comprehensive brand analysis
 *
 * @route POST /api/analysis/run
 * @body {string} brandKitId - ID of the brand kit to check against
 * @body {string} designId - ID of the design to analyze
 * @body {boolean} useAI - Whether to use Gemini AI (default: true)
 */
export const runAnalysis = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { brandKitId, designId, useAI = true } = req.body;

    // Validate required fields
    if (!brandKitId) {
      return res.status(400).json(errorResponse("Brand Kit ID is required"));
    }

    if (!designId) {
      return res.status(400).json(errorResponse("Design ID is required"));
    }

    // Fetch brand kit and design
    const [brandKit, design] = await Promise.all([
      BrandKit.findById(brandKitId),
      Design.findById(designId),
    ]);

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    if (brandKit.isArchived) {
      return res.status(400).json(errorResponse("Brand kit has been archived"));
    }

    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    logger.info(
      `Starting analysis: Design ${designId} against BrandKit ${brandKitId}`
    );

    // ---------------------------------------------------------------------------
    // MODULAR ANALYSIS
    // ---------------------------------------------------------------------------

    let analysisResult;

    if (useAI) {
      // Use Gemini AI for comprehensive analysis
      analysisResult = await geminiService.runBrandAnalysis(brandKit, design);
    } else {
      // Use modular service-based analysis
      const allViolations = [];
      const categoryScores = [];

      // 1. Color Check
      const colorResult = colorCheckService.checkAllColors(
        design.colorsUsed,
        brandKit.colors
      );
      categoryScores.push({
        category: "color",
        score: colorResult.score,
        weight: 0.3,
        violations: colorResult.violations.length,
      });
      allViolations.push(...colorResult.violations);

      // 2. Font Check
      const fontResult = fontCheckService.checkAllFonts(
        design.fontsUsed,
        brandKit.fonts
      );
      categoryScores.push({
        category: "typography",
        score: fontResult.score,
        weight: 0.25,
        violations: fontResult.violations.length,
      });
      allViolations.push(...fontResult.violations);

      // 3. Logo Check
      const logoResult = logoCheckService.checkAllLogos(
        design.images,
        brandKit.logoRules
      );
      categoryScores.push({
        category: "logo",
        score: logoResult.score,
        weight: 0.2,
        violations: logoResult.violations.length,
      });
      allViolations.push(...logoResult.violations);

      // 4. Accessibility Check
      const accessibilityResult = accessibilityService.checkDesignAccessibility(
        design,
        brandKit.accessibilityRules
      );
      categoryScores.push({
        category: "accessibility",
        score: accessibilityResult.score,
        weight: 0.15,
        violations: accessibilityResult.violations.length,
      });
      allViolations.push(...accessibilityResult.violations);

      // 5. Tone Check
      const allText = design.textContent?.map((t) => t.text).join(" ") || "";
      const toneResult = await toneCheckService.checkToneCompliance(
        allText,
        brandKit.toneRules
      );
      categoryScores.push({
        category: "tone",
        score: toneResult.score,
        weight: 0.1,
        violations: toneResult.violations.length,
      });
      allViolations.push(...toneResult.violations);

      // Calculate weighted overall score
      const complianceScore = Math.round(
        categoryScores.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
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

      analysisResult = {
        complianceScore,
        summary,
        categoryScores,
        violations: allViolations,
        usedAI: false,
      };
    }

    // ---------------------------------------------------------------------------
    // SAVE ANALYSIS RESULT
    // ---------------------------------------------------------------------------

    // Transform categoryScores from Gemini object format to array format if needed
    let formattedCategoryScores = [];
    if (analysisResult.categoryScores) {
      if (Array.isArray(analysisResult.categoryScores)) {
        // Already in array format (from modular analysis)
        formattedCategoryScores = analysisResult.categoryScores;
      } else if (typeof analysisResult.categoryScores === "object") {
        // Object format from Gemini AI - transform to array
        const weights = {
          color: 0.3,
          typography: 0.25,
          logo: 0.2,
          accessibility: 0.15,
          tone: 0.1,
        };
        formattedCategoryScores = Object.entries(
          analysisResult.categoryScores
        ).map(([category, score]) => ({
          category,
          score: typeof score === "number" ? score : 0,
          weight: weights[category] || 0.2,
          violations:
            analysisResult.violations?.filter(
              (v) =>
                v.type === category ||
                (category === "typography" && v.type === "font")
            ).length || 0,
        }));
      }
    }

    const savedResult = new AnalysisResult({
      designId: design._id,
      brandKitId: brandKit._id,
      complianceScore: analysisResult.complianceScore || 0,
      violations: analysisResult.violations || [],
      categoryScores: formattedCategoryScores,
      summary: analysisResult.summary || "Analysis complete.",
      usedAI: analysisResult.usedAI !== false,
      processingTime: Date.now() - startTime,
      status: "completed",
    });

    await savedResult.save();

    // Update design status
    design.status = "analyzed";
    await design.save();

    logger.info(
      `Analysis complete: Score ${savedResult.complianceScore}, ${savedResult.violations.length} violations`
    );

    // ---------------------------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------------------------

    res.json(
      successResponse(
        {
          analysisId: savedResult._id,
          complianceScore: savedResult.complianceScore,
          scoreLabel: savedResult.scoreLabel,
          violations: savedResult.violations.map((v) => ({
            type: v.type,
            severity: v.severity,
            description: v.description,
            affectedElement: v.affectedElement,
            suggestedFix: v.suggestedFix,
            autoFixable: v.autoFixable,
          })),
          categoryScores: savedResult.categoryScores,
          summary: savedResult.summary,
          processingTime: savedResult.processingTime,
        },
        "Brand analysis completed successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get analysis result by ID
 *
 * @route GET /api/analysis/:id
 * @param {string} id - Analysis result ID
 */
export const getAnalysis = async (req, res, next) => {
  try {
    const { id } = req.params;

    const analysis = await AnalysisResult.findById(id)
      .populate("designId", "canvasId name colorsUsed fontsUsed")
      .populate("brandKitId", "name");

    if (!analysis) {
      return res.status(404).json(errorResponse("Analysis result not found"));
    }

    res.json(
      successResponse(
        { analysis: analysis.toClientResponse() },
        "Analysis result retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get analysis history
 *
 * @route GET /api/analysis/history
 * @query {string} designId - Filter by design ID
 * @query {string} brandKitId - Filter by brand kit ID
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 */
export const getAnalysisHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { designId, brandKitId } = req.query;

    const query = { status: "completed" };
    if (designId) query.designId = designId;
    if (brandKitId) query.brandKitId = brandKitId;

    const [analyses, total] = await Promise.all([
      AnalysisResult.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("designId", "canvasId name")
        .populate("brandKitId", "name"),
      AnalysisResult.countDocuments(query),
    ]);

    res.json(
      successResponse(
        {
          analyses: analyses.map((a) => ({
            id: a._id,
            design: a.designId,
            brandKit: a.brandKitId,
            complianceScore: a.complianceScore,
            scoreLabel: a.scoreLabel,
            violationsCount: a.violations.length,
            createdAt: a.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Analysis history retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

export default {
  runAnalysis,
  getAnalysis,
  getAnalysisHistory,
};
