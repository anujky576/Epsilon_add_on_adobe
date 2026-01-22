/**
 * =============================================================================
 * Epsilon - Analytics Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This controller provides aggregated analytics for brand compliance.
 * It uses MongoDB aggregation pipeline for efficient data processing.
 *
 * ENDPOINTS:
 * - GET /api/analytics - Get aggregated analytics
 */

import AnalysisResult from "../models/AnalysisResult.js";
import Design from "../models/Design.js";
import BrandKit from "../models/BrandKit.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Get aggregated analytics
 *
 * @route GET /api/analytics
 * @query {string} startDate - Filter start date (ISO 8601)
 * @query {string} endDate - Filter end date (ISO 8601)
 * @query {string} brandKitId - Filter by brand kit
 */
export const getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, brandKitId } = req.query;

    // Build match query
    const match = { status: "completed" };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    if (brandKitId) {
      match.brandKitId = brandKitId;
    }

    // Run aggregations in parallel
    const [
      overallStats,
      violationsByType,
      scoreDistribution,
      recentTrend,
      counts,
    ] = await Promise.all([
      // Overall statistics
      AnalysisResult.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalScans: { $sum: 1 },
            averageScore: { $avg: "$complianceScore" },
            minScore: { $min: "$complianceScore" },
            maxScore: { $max: "$complianceScore" },
            totalViolations: { $sum: { $size: "$violations" } },
            avgProcessingTime: { $avg: "$processingTime" },
          },
        },
      ]),

      // Violations by type
      AnalysisResult.aggregate([
        { $match: match },
        { $unwind: "$violations" },
        {
          $group: {
            _id: "$violations.type",
            count: { $sum: 1 },
            avgSeverity: {
              $avg: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ["$violations.severity", "critical"] },
                      then: 4,
                    },
                    {
                      case: { $eq: ["$violations.severity", "high"] },
                      then: 3,
                    },
                    {
                      case: { $eq: ["$violations.severity", "medium"] },
                      then: 2,
                    },
                    { case: { $eq: ["$violations.severity", "low"] }, then: 1 },
                  ],
                  default: 0,
                },
              },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Score distribution (buckets)
      AnalysisResult.aggregate([
        { $match: match },
        {
          $bucket: {
            groupBy: "$complianceScore",
            boundaries: [0, 25, 50, 75, 90, 101],
            default: "Other",
            output: {
              count: { $sum: 1 },
              avgScore: { $avg: "$complianceScore" },
            },
          },
        },
      ]),

      // Recent trend (last 7 days)
      AnalysisResult.aggregate([
        {
          $match: {
            ...match,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            avgScore: { $avg: "$complianceScore" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Entity counts
      Promise.all([
        Design.countDocuments(),
        BrandKit.countDocuments({ isArchived: false }),
        AnalysisResult.countDocuments({ status: "completed" }),
      ]),
    ]);

    // Format response
    const stats = overallStats[0] || {
      totalScans: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      totalViolations: 0,
      avgProcessingTime: 0,
    };

    // Map score distribution to labels
    const scoreLabels = {
      0: "Poor (0-24)",
      25: "Needs Work (25-49)",
      50: "Fair (50-74)",
      75: "Good (75-89)",
      90: "Excellent (90-100)",
    };

    const formattedScoreDistribution = scoreDistribution.map((bucket) => ({
      label: scoreLabels[bucket._id] || bucket._id,
      range: `${bucket._id}-${bucket._id === 90 ? 100 : bucket._id + 24}`,
      count: bucket.count,
      avgScore: Math.round(bucket.avgScore * 10) / 10,
    }));

    // Top violation categories
    const topViolationCategories = violationsByType.slice(0, 5).map((v) => ({
      category: v._id,
      count: v.count,
      avgSeverity: Math.round(v.avgSeverity * 10) / 10,
    }));

    res.json(
      successResponse(
        {
          overview: {
            totalScans: stats.totalScans,
            averageComplianceScore: Math.round(stats.averageScore * 10) / 10,
            lowestScore: stats.minScore,
            highestScore: stats.maxScore,
            totalViolationsFound: stats.totalViolations,
            averageProcessingTime: Math.round(stats.avgProcessingTime),
          },
          topViolationCategories,
          scoreDistribution: formattedScoreDistribution,
          trend: {
            period: "last_7_days",
            data: recentTrend.map((d) => ({
              date: d._id,
              averageScore: Math.round(d.avgScore * 10) / 10,
              scansCount: d.count,
            })),
          },
          entityCounts: {
            designs: counts[0],
            brandKits: counts[1],
            analyses: counts[2],
          },
        },
        "Analytics retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get quick stats for dashboard
 *
 * @route GET /api/analytics/quick
 */
export const getQuickStats = async (req, res, next) => {
  try {
    const [recentAnalysis, designCount, brandKitCount, last24hScans] =
      await Promise.all([
        AnalysisResult.findOne({ status: "completed" })
          .sort({ createdAt: -1 })
          .select("complianceScore violations createdAt"),
        Design.countDocuments(),
        BrandKit.countDocuments({ isArchived: false }),
        AnalysisResult.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      ]);

    res.json(
      successResponse(
        {
          lastAnalysis: recentAnalysis
            ? {
                score: recentAnalysis.complianceScore,
                violationsCount: recentAnalysis.violations.length,
                timestamp: recentAnalysis.createdAt,
              }
            : null,
          totalDesigns: designCount,
          totalBrandKits: brandKitCount,
          scansLast24h: last24hScans,
        },
        "Quick stats retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

export default {
  getAnalytics,
  getQuickStats,
};
