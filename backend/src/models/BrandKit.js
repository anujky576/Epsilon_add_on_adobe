/**
 * =============================================================================
 * BrandGuard AI - Brand Kit Model
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * The Brand Kit is the central configuration for brand compliance checking.
 * It defines all the rules that designs must follow, including:
 * - Color palette with tolerance for color matching
 * - Typography rules with approved fonts and fallbacks
 * - Logo usage guidelines (minimum sizes, spacing)
 * - Accessibility requirements (WCAG contrast ratios)
 * - Tone and voice guidelines
 *
 * DESIGN PRINCIPLE:
 * Each rule type is stored as a structured subdocument to allow for granular
 * validation and easy extension of rule types.
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// SUB-SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Color definition with tolerance for fuzzy matching
 * TOLERANCE: Allowed deviation in Delta-E color space (0-100)
 * - 0: Exact match required
 * - 5: Barely noticeable difference
 * - 10: Small but noticeable difference
 * - 20: Large difference
 */
const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hex: {
      type: String,
      required: true,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format"],
    },
    tolerance: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    usage: {
      type: String,
      enum: ["primary", "secondary", "accent", "background", "text", "any"],
      default: "any",
    },
  },
  { _id: false }
);

/**
 * Font definition with fallback options
 */
const fontSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fallbacks: [
      {
        type: String,
        trim: true,
      },
    ],
    usage: {
      type: String,
      enum: ["heading", "body", "accent", "any"],
      default: "any",
    },
    weights: [
      {
        type: Number,
        min: 100,
        max: 900,
      },
    ],
  },
  { _id: false }
);

/**
 * Logo usage rules
 */
const logoRulesSchema = new mongoose.Schema(
  {
    minWidth: {
      type: Number,
      default: 50,
      min: 1,
    },
    minHeight: {
      type: Number,
      default: 50,
      min: 1,
    },
    clearSpaceRatio: {
      type: Number,
      default: 0.1, // 10% of logo size as clear space
      min: 0,
      max: 1,
    },
    allowedBackgrounds: [
      {
        type: String,
        match: [
          /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          "Invalid hex color format",
        ],
      },
    ],
    aspectRatioTolerance: {
      type: Number,
      default: 0.05, // 5% tolerance
      min: 0,
      max: 0.5,
    },
  },
  { _id: false }
);

/**
 * Accessibility rules based on WCAG guidelines
 */
const accessibilityRulesSchema = new mongoose.Schema(
  {
    minContrastRatio: {
      type: Number,
      default: 4.5, // WCAG AA standard
      min: 1,
      max: 21,
    },
    largeTextMinContrast: {
      type: Number,
      default: 3, // WCAG AA for large text
      min: 1,
      max: 21,
    },
    requireAltText: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/**
 * Tone and language rules
 */
const toneRulesSchema = new mongoose.Schema(
  {
    style: {
      type: String,
      enum: ["formal", "casual", "professional", "friendly", "any"],
      default: "professional",
    },
    bannedWords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    requiredPhrases: [
      {
        type: String,
        trim: true,
      },
    ],
    maxSentenceLength: {
      type: Number,
      default: null, // null means no limit
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// MAIN BRAND KIT SCHEMA
// ---------------------------------------------------------------------------

const brandKitSchema = new mongoose.Schema(
  {
    /**
     * Brand kit name for identification
     */
    name: {
      type: String,
      required: [true, "Brand kit name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    /**
     * Optional description of the brand kit
     */
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    /**
     * Owner of this brand kit
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    /**
     * Approved brand colors
     */
    colors: {
      type: [colorSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one color is required in the brand kit",
      },
    },

    /**
     * Approved fonts
     */
    fonts: {
      type: [fontSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: "At least one font is required in the brand kit",
      },
    },

    /**
     * Logo usage rules
     */
    logoRules: {
      type: logoRulesSchema,
      default: () => ({}),
    },

    /**
     * Accessibility requirements
     */
    accessibilityRules: {
      type: accessibilityRulesSchema,
      default: () => ({}),
    },

    /**
     * Tone and language guidelines
     */
    toneRules: {
      type: toneRulesSchema,
      default: () => ({}),
    },

    /**
     * Version number (auto-incremented on updates)
     */
    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    /**
     * Version history - stores snapshots of previous versions
     */
    versionHistory: [
      {
        version: { type: Number, required: true },
        snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
        changedAt: { type: Date, default: Date.now },
        changeNote: { type: String, default: "" },
      },
    ],

    /**
     * Whether this is the default brand kit for the user
     */
    isDefault: {
      type: Boolean,
      default: false,
    },

    /**
     * Soft delete flag
     */
    isArchived: {
      type: Boolean,
      default: false,
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
brandKitSchema.index({ userId: 1, isArchived: 1 });
brandKitSchema.index({ name: "text", description: "text" });
brandKitSchema.index({ version: 1 });

// ---------------------------------------------------------------------------
// VIRTUALS
// ---------------------------------------------------------------------------
/**
 * Get count of analyses using this brand kit
 */
brandKitSchema.virtual("analysesCount", {
  ref: "AnalysisResult",
  localField: "_id",
  foreignField: "brandKitId",
  count: true,
});

// ---------------------------------------------------------------------------
// STATICS
// ---------------------------------------------------------------------------
/**
 * Find brand kits by user with optional filtering
 */
brandKitSchema.statics.findByUser = function (userId, includeArchived = false) {
  const query = { userId };
  if (!includeArchived) {
    query.isArchived = false;
  }
  return this.find(query).sort({ isDefault: -1, createdAt: -1 });
};

// ---------------------------------------------------------------------------
// METHODS
// ---------------------------------------------------------------------------
/**
 * Get a summary of the brand kit rules for analysis prompts
 */
brandKitSchema.methods.toAnalysisPrompt = function () {
  return {
    name: this.name,
    colors: this.colors.map((c) => ({
      name: c.name,
      hex: c.hex,
      tolerance: c.tolerance,
      usage: c.usage,
    })),
    fonts: this.fonts.map((f) => ({
      name: f.name,
      fallbacks: f.fallbacks,
      usage: f.usage,
    })),
    logoRules: {
      minWidth: this.logoRules.minWidth,
      minHeight: this.logoRules.minHeight,
      clearSpaceRatio: this.logoRules.clearSpaceRatio,
    },
    accessibilityRules: {
      minContrastRatio: this.accessibilityRules.minContrastRatio,
      requireAltText: this.accessibilityRules.requireAltText,
    },
    toneRules: {
      style: this.toneRules.style,
      bannedWords: this.toneRules.bannedWords,
    },
    version: this.version,
  };
};

/**
 * Create a snapshot of current state for version history
 */
brandKitSchema.methods.createVersionSnapshot = function (changeNote = "") {
  const snapshot = {
    name: this.name,
    description: this.description,
    colors: this.colors.map((c) => ({ ...(c.toObject ? c.toObject() : c) })),
    fonts: this.fonts.map((f) => ({ ...(f.toObject ? f.toObject() : f) })),
    logoRules: this.logoRules.toObject
      ? this.logoRules.toObject()
      : this.logoRules,
    accessibilityRules: this.accessibilityRules.toObject
      ? this.accessibilityRules.toObject()
      : this.accessibilityRules,
    toneRules: this.toneRules.toObject
      ? this.toneRules.toObject()
      : this.toneRules,
  };

  this.versionHistory.push({
    version: this.version,
    snapshot,
    changedAt: new Date(),
    changeNote,
  });

  // Keep only last 20 versions to prevent unbounded growth
  if (this.versionHistory.length > 20) {
    this.versionHistory = this.versionHistory.slice(-20);
  }

  this.version += 1;
  return this;
};

/**
 * Get a specific version from history
 */
brandKitSchema.methods.getVersion = function (versionNumber) {
  if (versionNumber === this.version) {
    return this.toAnalysisPrompt();
  }
  const historyEntry = this.versionHistory.find(
    (v) => v.version === versionNumber
  );
  return historyEntry ? historyEntry.snapshot : null;
};

const BrandKit = mongoose.model("BrandKit", brandKitSchema);

export default BrandKit;
