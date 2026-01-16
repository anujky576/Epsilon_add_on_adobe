/**
 * =============================================================================
 * BrandGuard AI - Report Model
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Reports provide a comprehensive, shareable summary of brand compliance
 * analyses. They can include multiple analyses over time and are designed
 * for export/sharing with stakeholders.
 *
 * USE CASES:
 * - Generate PDF-ready compliance reports
 * - Track brand compliance trends over time
 * - Share compliance status with team members
 * - Archive historical analysis data
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// SUB-SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Analysis snapshot for historical reference
 */
const analysisSnapshotSchema = new mongoose.Schema(
  {
    analysisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AnalysisResult",
      required: true,
    },
    designId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Design",
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    violationsCount: {
      type: Number,
      default: 0,
    },
    analyzedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Summary statistics for the report
 */
const reportSummarySchema = new mongoose.Schema(
  {
    totalDesignsAnalyzed: {
      type: Number,
      default: 0,
    },
    averageComplianceScore: {
      type: Number,
      default: 0,
    },
    totalViolations: {
      type: Number,
      default: 0,
    },
    criticalViolations: {
      type: Number,
      default: 0,
    },
    topViolationTypes: [
      {
        type: { type: String },
        count: Number,
      },
    ],
    complianceTrend: {
      type: String,
      enum: ["improving", "declining", "stable", "insufficient_data"],
      default: "insufficient_data",
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// MAIN REPORT SCHEMA
// ---------------------------------------------------------------------------

const reportSchema = new mongoose.Schema(
  {
    /**
     * Report title
     */
    title: {
      type: String,
      required: [true, "Report title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    /**
     * Report description
     */
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    /**
     * Report owner
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * Brand kit this report is based on
     */
    brandKitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BrandKit",
      required: true,
      index: true,
    },

    /**
     * Analyses included in this report
     */
    analyses: {
      type: [analysisSnapshotSchema],
      default: [],
    },

    /**
     * Report summary statistics
     */
    summary: {
      type: reportSummarySchema,
      default: () => ({}),
    },

    /**
     * Report type
     */
    type: {
      type: String,
      enum: ["single", "batch", "periodic", "custom"],
      default: "single",
    },

    /**
     * Date range for the report
     */
    dateRange: {
      start: {
        type: Date,
        default: null,
      },
      end: {
        type: Date,
        default: null,
      },
    },

    /**
     * Report status
     */
    status: {
      type: String,
      enum: ["generating", "completed", "failed"],
      default: "completed",
    },

    /**
     * Report format preferences
     */
    format: {
      includeViolationDetails: {
        type: Boolean,
        default: true,
      },
      includeSuggestions: {
        type: Boolean,
        default: true,
      },
      includeCharts: {
        type: Boolean,
        default: true,
      },
    },

    /**
     * Share settings
     */
    sharing: {
      isPublic: {
        type: Boolean,
        default: false,
      },
      shareToken: {
        type: String,
        default: null,
      },
      sharedWith: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },

    /**
     * Generation timestamp
     */
    generatedAt: {
      type: Date,
      default: Date.now,
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
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ brandKitId: 1 });
reportSchema.index({ "sharing.shareToken": 1 });

// ---------------------------------------------------------------------------
// VIRTUALS
// ---------------------------------------------------------------------------
/**
 * Get count of analyses in the report
 */
reportSchema.virtual("analysesCount").get(function () {
  return this.analyses.length;
});

// ---------------------------------------------------------------------------
// STATICS
// ---------------------------------------------------------------------------
/**
 * Generate a shareable token for the report
 */
reportSchema.statics.generateShareToken = function () {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Find reports by user with pagination
 */
reportSchema.statics.findByUser = function (userId, options = {}) {
  const { page = 1, limit = 10 } = options;
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("brandKitId", "name");
};

// ---------------------------------------------------------------------------
// METHODS
// ---------------------------------------------------------------------------
/**
 * Calculate summary from analyses
 */
reportSchema.methods.calculateSummary = function () {
  if (this.analyses.length === 0) {
    this.summary = {
      totalDesignsAnalyzed: 0,
      averageComplianceScore: 0,
      totalViolations: 0,
      criticalViolations: 0,
      topViolationTypes: [],
      complianceTrend: "insufficient_data",
    };
    return;
  }

  const scores = this.analyses.map((a) => a.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const totalViolations = this.analyses.reduce(
    (sum, a) => sum + a.violationsCount,
    0
  );

  // Determine trend (simple comparison of first half vs second half)
  let trend = "stable";
  if (this.analyses.length >= 4) {
    const midpoint = Math.floor(this.analyses.length / 2);
    const firstHalfAvg =
      scores.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
    const secondHalfAvg =
      scores.slice(midpoint).reduce((a, b) => a + b, 0) /
      (scores.length - midpoint);

    if (secondHalfAvg - firstHalfAvg > 5) {
      trend = "improving";
    } else if (firstHalfAvg - secondHalfAvg > 5) {
      trend = "declining";
    }
  } else {
    trend = "insufficient_data";
  }

  this.summary = {
    totalDesignsAnalyzed: this.analyses.length,
    averageComplianceScore: Math.round(avgScore * 10) / 10,
    totalViolations,
    criticalViolations: 0, // Would need violation details to calculate
    topViolationTypes: [],
    complianceTrend: trend,
  };
};

/**
 * Generate a public shareable link
 */
reportSchema.methods.enableSharing = async function () {
  if (!this.sharing.shareToken) {
    this.sharing.shareToken = this.constructor.generateShareToken();
    this.sharing.isPublic = true;
    await this.save();
  }
  return this.sharing.shareToken;
};

/**
 * Get client-friendly response
 */
reportSchema.methods.toClientResponse = function () {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    brandKit: this.brandKitId,
    summary: this.summary,
    analysesCount: this.analyses.length,
    type: this.type,
    dateRange: this.dateRange,
    status: this.status,
    generatedAt: this.generatedAt,
    createdAt: this.createdAt,
  };
};

const Report = mongoose.model("Report", reportSchema);

export default Report;
