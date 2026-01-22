/**
 * =============================================================================
 * Epsilon - Analysis Result Model
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This model stores the complete results of a brand compliance analysis.
 * Each analysis links a Design to a BrandKit and stores:
 * - Overall compliance score (0-100)
 * - Detailed violations with severity and suggested fixes
 * - Category-wise scores for granular insight
 * - Timestamps for historical tracking
 *
 * SCORING SYSTEM:
 * - 90-100: Excellent - Design fully follows brand guidelines
 * - 70-89: Good - Minor deviations, easily fixable
 * - 50-69: Needs Work - Multiple violations requiring attention
 * - 0-49: Poor - Major brand guideline violations
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// SUB-SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Individual violation record
 */
const violationSchema = new mongoose.Schema(
  {
    /**
     * Type of violation
     */
    type: {
      type: String,
      required: true,
      enum: [
        "color",
        "font",
        "typography",
        "logo",
        "accessibility",
        "tone",
        "spacing",
        "layout",
        "other",
      ],
    },

    /**
     * Severity level - affects scoring weight
     */
    severity: {
      type: String,
      required: true,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
    },

    /**
     * Human-readable description of the violation
     */
    description: {
      type: String,
      required: true,
    },

    /**
     * The element in the design that caused the violation
     * (e.g., hex color code, font name, text content)
     */
    affectedElement: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    /**
     * Suggested fix for the violation
     */
    suggestedFix: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /**
     * Whether this violation can be auto-fixed
     */
    autoFixable: {
      type: Boolean,
      default: false,
    },

    /**
     * Whether this violation has been resolved
     */
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Category-wise score breakdown
 */
const categoryScoreSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["color", "typography", "logo", "accessibility", "tone", "overall"],
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    weight: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 5,
    },
    violations: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// MAIN ANALYSIS RESULT SCHEMA
// ---------------------------------------------------------------------------

const analysisResultSchema = new mongoose.Schema(
  {
    /**
     * Reference to the design that was analyzed
     */
    designId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      required: [true, "Design ID is required"],
      index: true,
    },

    /**
     * Reference to the brand kit used for analysis
     */
    brandKitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandKit",
      required: [true, "Brand Kit ID is required"],
      index: true,
    },

    /**
     * User who initiated the analysis
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    /**
     * Overall compliance score (0-100)
     * CRITICAL: This is the main metric shown to users
     */
    complianceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    /**
     * Score interpretation - set by pre-save middleware
     */
    scoreLabel: {
      type: String,
      enum: ["excellent", "good", "needs_work", "poor"],
      // Not required - automatically set by pre-save middleware based on complianceScore
    },

    /**
     * List of all violations found
     */
    violations: {
      type: [violationSchema],
      default: [],
    },

    /**
     * Category-wise score breakdown
     */
    categoryScores: {
      type: [categoryScoreSchema],
      default: [],
    },

    /**
     * Summary text for quick overview
     */
    summary: {
      type: String,
      maxlength: 1000,
    },

    /**
     * Whether AI (Gemini) was used for this analysis
     */
    usedAI: {
      type: Boolean,
      default: false,
    },

    /**
     * Time taken to complete the analysis (ms)
     */
    processingTime: {
      type: Number,
      default: 0,
    },

    /**
     * Analysis status
     */
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },

    /**
     * Error message if analysis failed
     */
    errorMessage: {
      type: String,
      default: null,
    },

    /**
     * Brand kit version used for this analysis (audit trail)
     */
    brandKitVersion: {
      type: Number,
      default: 1,
    },

    /**
     * Risk Scoring Breakdown
     * Each risk score is 0-100, where 100 means high risk
     */
    riskScores: {
      brandRisk: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      accessibilityRisk: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      legalRisk: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },

    /**
     * AI-generated executive insight (high-level summary for stakeholders)
     */
    executiveInsight: {
      type: String,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// INDEXES
// ---------------------------------------------------------------------------
analysisResultSchema.index({ designId: 1, brandKitId: 1 });
analysisResultSchema.index({ userId: 1, createdAt: -1 });
analysisResultSchema.index({ complianceScore: 1 });
analysisResultSchema.index({ createdAt: -1 });

// ---------------------------------------------------------------------------
// PRE-SAVE MIDDLEWARE
// ---------------------------------------------------------------------------
/**
 * Calculate score label before saving
 */
analysisResultSchema.pre("save", function (next) {
  const score = this.complianceScore;
  if (score >= 90) {
    this.scoreLabel = "excellent";
  } else if (score >= 70) {
    this.scoreLabel = "good";
  } else if (score >= 50) {
    this.scoreLabel = "needs_work";
  } else {
    this.scoreLabel = "poor";
  }
  next();
});

// ---------------------------------------------------------------------------
// STATICS
// ---------------------------------------------------------------------------
/**
 * Get analytics aggregation for a user
 */
analysisResultSchema.statics.getAnalytics = async function (
  userId,
  options = {}
) {
  const { startDate, endDate } = options;

  const match = {
    userId: new mongoose.Types.ObjectId(userId),
    status: "completed",
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const results = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalScans: { $sum: 1 },
        averageScore: { $avg: "$complianceScore" },
        minScore: { $min: "$complianceScore" },
        maxScore: { $max: "$complianceScore" },
        totalViolations: { $sum: { $size: "$violations" } },
      },
    },
  ]);

  return (
    results[0] || {
      totalScans: 0,
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      totalViolations: 0,
    }
  );
};

/**
 * Get top violation categories
 */
analysisResultSchema.statics.getTopViolationCategories = async function (
  userId,
  limit = 5
) {
  const results = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: "completed",
      },
    },
    { $unwind: "$violations" },
    {
      $group: {
        _id: "$violations.type",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return results.map((r) => ({ category: r._id, count: r.count }));
};

// ---------------------------------------------------------------------------
// METHODS
// ---------------------------------------------------------------------------
/**
 * Get a client-friendly response format
 */
analysisResultSchema.methods.toClientResponse = function () {
  return {
    id: this._id,
    complianceScore: this.complianceScore,
    scoreLabel: this.scoreLabel,
    violations: this.violations.map((v) => ({
      id: v._id,
      type: v.type,
      severity: v.severity,
      description: v.description,
      affectedElement: v.affectedElement,
      suggestedFix: v.suggestedFix,
      autoFixable: v.autoFixable,
    })),
    categoryScores: this.categoryScores,
    summary: this.summary,
    createdAt: this.createdAt,
  };
};

/**
 * Get violations that can be auto-fixed
 */
analysisResultSchema.methods.getAutoFixableViolations = function () {
  return this.violations.filter((v) => v.autoFixable && !v.resolved);
};

const AnalysisResult = mongoose.model("AnalysisResult", analysisResultSchema);

export default AnalysisResult;
