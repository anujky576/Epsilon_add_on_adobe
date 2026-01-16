/**
 * =============================================================================
 * BrandGuard AI - Report Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This controller handles generation and retrieval of compliance reports.
 * Reports aggregate multiple analyses into shareable documents.
 *
 * ENDPOINTS:
 * - POST /api/report/generate - Generate new report
 * - GET  /api/report/:id      - Get report by ID
 * - GET  /api/report          - List reports
 */

import Report from "../models/Report.js";
import AnalysisResult from "../models/AnalysisResult.js";
import BrandKit from "../models/BrandKit.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Generate a new compliance report
 *
 * @route POST /api/report/generate
 * @body {string} title - Report title
 * @body {string} brandKitId - Brand kit to report on
 * @body {string} analysisId - Single analysis to include (optional)
 * @body {Object} dateRange - Date range for multiple analyses { start, end }
 */
export const generateReport = async (req, res, next) => {
  try {
    const { title, description, brandKitId, analysisId, dateRange } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json(errorResponse("Report title is required"));
    }

    if (!brandKitId) {
      return res.status(400).json(errorResponse("Brand Kit ID is required"));
    }

    // Verify brand kit exists
    const brandKit = await BrandKit.findById(brandKitId);
    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    // Build query for analyses
    const analysisQuery = { brandKitId, status: "completed" };

    if (analysisId) {
      // Single analysis report
      analysisQuery._id = analysisId;
    } else if (dateRange) {
      // Date range report
      if (dateRange.start) {
        analysisQuery.createdAt = { $gte: new Date(dateRange.start) };
      }
      if (dateRange.end) {
        analysisQuery.createdAt = {
          ...analysisQuery.createdAt,
          $lte: new Date(dateRange.end),
        };
      }
    }

    // Fetch analyses
    const analyses = await AnalysisResult.find(analysisQuery)
      .sort({ createdAt: -1 })
      .limit(100) // Limit to prevent massive reports
      .populate("designId", "canvasId name");

    if (analyses.length === 0) {
      return res
        .status(404)
        .json(errorResponse("No analyses found for this brand kit"));
    }

    // Create analysis snapshots
    const analysisSnapshots = analyses.map((a) => ({
      analysisId: a._id,
      designId: a.designId._id || a.designId,
      score: a.complianceScore,
      violationsCount: a.violations.length,
      analyzedAt: a.createdAt,
    }));

    // Create report
    const report = new Report({
      title,
      description,
      brandKitId,
      analyses: analysisSnapshots,
      type: analysisId ? "single" : dateRange ? "periodic" : "batch",
      dateRange: dateRange
        ? {
            start: dateRange.start ? new Date(dateRange.start) : null,
            end: dateRange.end ? new Date(dateRange.end) : null,
          }
        : null,
      format: {
        includeViolationDetails: true,
        includeSuggestions: true,
        includeCharts: true,
      },
    });

    // Calculate summary
    report.calculateSummary();

    await report.save();

    logger.info(`Report generated: ${report._id} - ${report.title}`);

    res.status(201).json(
      successResponse(
        {
          report: {
            id: report._id,
            title: report.title,
            brandKit: {
              id: brandKit._id,
              name: brandKit.name,
            },
            summary: report.summary,
            analysesCount: report.analyses.length,
            generatedAt: report.generatedAt,
          },
        },
        "Report generated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a report by ID
 *
 * @route GET /api/report/:id
 * @param {string} id - Report ID
 */
export const getReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id).populate(
      "brandKitId",
      "name colors fonts"
    );

    if (!report) {
      return res.status(404).json(errorResponse("Report not found"));
    }

    res.json(
      successResponse(
        { report: report.toClientResponse() },
        "Report retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get full report with analysis details
 *
 * @route GET /api/report/:id/full
 * @param {string} id - Report ID
 */
export const getFullReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id).populate(
      "brandKitId",
      "name colors fonts logoRules accessibilityRules"
    );

    if (!report) {
      return res.status(404).json(errorResponse("Report not found"));
    }

    // Fetch full analysis details
    const analysisIds = report.analyses.map((a) => a.analysisId);
    const fullAnalyses = await AnalysisResult.find({
      _id: { $in: analysisIds },
    }).populate("designId", "canvasId name colorsUsed fontsUsed");

    res.json(
      successResponse(
        {
          report: {
            ...report.toClientResponse(),
            fullAnalyses: fullAnalyses.map((a) => a.toClientResponse()),
          },
        },
        "Full report retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List all reports
 *
 * @route GET /api/report
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 */
export const listReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      Report.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("brandKitId", "name"),
      Report.countDocuments(),
    ]);

    res.json(
      successResponse(
        {
          reports: reports.map((r) => ({
            id: r._id,
            title: r.title,
            brandKit: r.brandKitId,
            analysesCount: r.analyses.length,
            summary: r.summary,
            createdAt: r.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Reports retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a report
 *
 * @route DELETE /api/report/:id
 * @param {string} id - Report ID
 */
export const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;

    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json(errorResponse("Report not found"));
    }

    logger.info(`Report deleted: ${report._id}`);

    res.json(successResponse({ reportId: id }, "Report deleted successfully"));
  } catch (error) {
    next(error);
  }
};

export default {
  generateReport,
  getReport,
  getFullReport,
  listReports,
  deleteReport,
};
