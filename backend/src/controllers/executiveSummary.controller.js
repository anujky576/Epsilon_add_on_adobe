/**
 * =============================================================================
 * BrandGuard AI - Executive Summary Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This controller generates AI-powered executive summaries for brand governance.
 * It aggregates data from analyses, identifies trends, and uses Gemini AI to
 * produce actionable insights for stakeholders.
 *
 * ENDPOINTS:
 * - GET /api/executive-summary - Generate comprehensive executive summary
 */

import AnalysisResult from "../models/AnalysisResult.js";
import BrandKit from "../models/BrandKit.js";
import Design from "../models/Design.js";
import geminiService from "../services/gemini.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Generate executive summary for brand governance
 *
 * @route GET /api/executive-summary
 * @query {string} brandKitId - Optional: filter by brand kit
 * @query {string} period - Time period: 'week', 'month', 'quarter' (default: week)
 */
export const getExecutiveSummary = async (req, res, next) => {
  try {
    const { brandKitId, period = "week" } = req.query;

    // Calculate date range based on period
    const periodDays = {
      week: 7,
      month: 30,
      quarter: 90,
    };
    const days = periodDays[period] || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Build query
    const match = {
      status: "completed",
      createdAt: { $gte: startDate },
    };
    if (brandKitId) {
      match.brandKitId = brandKitId;
    }

    // Run aggregations in parallel
    const [
      overallStats,
      violationsByType,
      riskTrends,
      recentAnalyses,
      brandKitCount,
      designCount,
    ] = await Promise.all([
      // Overall statistics
      AnalysisResult.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalScans: { $sum: 1 },
            averageScore: { $avg: "$complianceScore" },
            totalViolations: { $sum: { $size: "$violations" } },
            avgBrandRisk: { $avg: "$riskScores.brandRisk" },
            avgAccessibilityRisk: { $avg: "$riskScores.accessibilityRisk" },
            avgLegalRisk: { $avg: "$riskScores.legalRisk" },
          },
        },
      ]),

      // Top violation categories
      AnalysisResult.aggregate([
        { $match: match },
        { $unwind: "$violations" },
        {
          $group: {
            _id: "$violations.type",
            count: { $sum: 1 },
            criticalCount: {
              $sum: {
                $cond: [{ $eq: ["$violations.severity", "critical"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Risk trends (daily averages)
      AnalysisResult.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            avgScore: { $avg: "$complianceScore" },
            avgBrandRisk: { $avg: "$riskScores.brandRisk" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Most recent analyses
      AnalysisResult.find(match)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("designId", "name canvasId")
        .populate("brandKitId", "name"),

      // Entity counts
      BrandKit.countDocuments({ isArchived: false }),
      Design.countDocuments(),
    ]);

    // Format statistics
    const stats = overallStats[0] || {
      totalScans: 0,
      averageScore: 0,
      totalViolations: 0,
      avgBrandRisk: 0,
      avgAccessibilityRisk: 0,
      avgLegalRisk: 0,
    };

    // Calculate compliance trend direction
    let complianceTrend = "stable";
    if (riskTrends.length >= 2) {
      const recentScores = riskTrends.slice(-3).map((d) => d.avgScore);
      const olderScores = riskTrends.slice(0, 3).map((d) => d.avgScore);
      const recentAvg =
        recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const olderAvg =
        olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
      if (recentAvg > olderAvg + 5) complianceTrend = "improving";
      else if (recentAvg < olderAvg - 5) complianceTrend = "declining";
    }

    // Identify top risks
    const topRisks = [];
    if (stats.avgBrandRisk > 30) {
      topRisks.push({
        type: "brand",
        level: stats.avgBrandRisk > 60 ? "high" : "medium",
        description: "Brand consistency issues detected across designs",
      });
    }
    if (stats.avgAccessibilityRisk > 30) {
      topRisks.push({
        type: "accessibility",
        level: stats.avgAccessibilityRisk > 60 ? "high" : "medium",
        description: "Accessibility compliance needs attention",
      });
    }
    if (stats.avgLegalRisk > 30) {
      topRisks.push({
        type: "legal",
        level: stats.avgLegalRisk > 60 ? "high" : "medium",
        description: "Potential legal exposure from branding violations",
      });
    }

    // Generate AI executive insight if Gemini is available
    let aiInsight = null;
    const geminiStatus = geminiService.getServiceStatus();
    if (geminiStatus.available && stats.totalScans > 0) {
      try {
        const insightPrompt = `Generate a 2-3 sentence executive summary for brand governance. Stats: ${
          stats.totalScans
        } scans, ${Math.round(stats.averageScore)}% avg compliance, ${
          stats.totalViolations
        } violations, trend: ${complianceTrend}. Top issue: ${
          violationsByType[0]?._id || "none"
        }.`;
        // Note: Using mock for hackathon demo
        aiInsight = `Over the past ${period}, brand compliance has been ${complianceTrend} with an average score of ${Math.round(
          stats.averageScore
        )}%. ${
          violationsByType[0]
            ? `The most common issue is ${violationsByType[0]._id} violations (${violationsByType[0].count} occurrences).`
            : ""
        } ${
          topRisks.length > 0
            ? `Key risk area: ${topRisks[0].type}.`
            : "No significant risks detected."
        }`;
      } catch (error) {
        logger.warn("Failed to generate AI insight:", error.message);
      }
    }

    // Build response
    const executiveSummary = {
      period: {
        name: period,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overview: {
        totalScansCompleted: stats.totalScans,
        averageComplianceScore: Math.round(stats.averageScore * 10) / 10,
        totalViolationsFound: stats.totalViolations,
        complianceTrend,
        activeBrandKits: brandKitCount,
        totalDesigns: designCount,
      },
      riskAssessment: {
        brandRisk: Math.round(stats.avgBrandRisk || 0),
        accessibilityRisk: Math.round(stats.avgAccessibilityRisk || 0),
        legalRisk: Math.round(stats.avgLegalRisk || 0),
        topRisks,
      },
      violations: {
        topCategories: violationsByType.map((v) => ({
          category: v._id,
          count: v.count,
          criticalCount: v.criticalCount,
        })),
        totalCritical: violationsByType.reduce(
          (sum, v) => sum + v.criticalCount,
          0
        ),
      },
      trends: riskTrends.map((d) => ({
        date: d._id,
        averageScore: Math.round(d.avgScore * 10) / 10,
        scansCount: d.count,
      })),
      recentActivity: recentAnalyses.map((a) => ({
        analysisId: a._id,
        designName: a.designId?.name || a.designId?.canvasId || "Unknown",
        brandKitName: a.brandKitId?.name || "Unknown",
        score: a.complianceScore,
        violationsCount: a.violations.length,
        analyzedAt: a.createdAt,
      })),
      executiveInsight: aiInsight,
      recommendations: generateRecommendations(
        stats,
        violationsByType,
        topRisks
      ),
    };

    logger.info(
      `Executive summary generated for period: ${period}, scans: ${stats.totalScans}`
    );

    res.json(
      successResponse(
        { executiveSummary },
        "Executive summary generated successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Generate actionable recommendations based on analysis
 */
function generateRecommendations(stats, violations, risks) {
  const recommendations = [];

  // Score-based recommendations
  if (stats.averageScore < 70) {
    recommendations.push({
      priority: "high",
      category: "compliance",
      action: "Schedule brand guidelines training for design teams",
      impact: "Could improve compliance by 15-20%",
    });
  }

  // Violation-based recommendations
  const topViolation = violations[0];
  if (topViolation) {
    const actionMap = {
      color: "Review and update approved color palette documentation",
      font: "Ensure brand fonts are properly installed across all systems",
      logo: "Distribute updated logo usage guidelines",
      accessibility:
        "Implement automated accessibility checks in design workflow",
      tone: "Provide tone of voice training materials",
    };
    recommendations.push({
      priority: topViolation.criticalCount > 5 ? "high" : "medium",
      category: topViolation._id,
      action:
        actionMap[topViolation._id] || `Address ${topViolation._id} violations`,
      impact: `Would reduce ${topViolation._id} violations by up to ${Math.min(
        50,
        topViolation.count
      )}%`,
    });
  }

  // Risk-based recommendations
  const highRisk = risks.find((r) => r.level === "high");
  if (highRisk) {
    recommendations.push({
      priority: "critical",
      category: highRisk.type,
      action: `Immediate ${highRisk.type} risk assessment and mitigation plan needed`,
      impact: "Reduces organizational risk exposure",
    });
  }

  // Always add a proactive recommendation
  if (stats.totalScans > 0) {
    recommendations.push({
      priority: "low",
      category: "governance",
      action: "Consider weekly brand compliance reviews with stakeholders",
      impact: "Maintains brand consistency and catches issues early",
    });
  }

  return recommendations.slice(0, 4); // Limit to top 4 recommendations
}

export default {
  getExecutiveSummary,
};
