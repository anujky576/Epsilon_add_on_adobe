/**
 * =============================================================================
 * BrandGuard AI - Design Model
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This model stores design data submitted from Adobe Express canvas.
 * The structure mirrors what the Add-on sends, making it easy to:
 * 1. Validate incoming data
 * 2. Store for historical analysis
 * 3. Compare against brand kits
 *
 * ADOBE EXPRESS INTEGRATION:
 * The Add-on reads the active canvas and extracts:
 * - Colors used in the design
 * - Fonts used in text elements
 * - Text content with font mapping
 * - Image dimensions (for logo checking)
 * - Layout information
 */

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// SUB-SCHEMAS
// ---------------------------------------------------------------------------

/**
 * Text element from the design
 */
const textContentSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
    },
    font: {
      type: String,
      default: "Unknown",
    },
    fontSize: {
      type: Number,
      default: 16,
    },
    color: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format"],
    },
    isBold: {
      type: Boolean,
      default: false,
    },
    isItalic: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/**
 * Image element from the design
 */
const imageSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["logo", "photo", "graphic", "icon", "background", "unknown"],
      default: "unknown",
    },
    width: {
      type: Number,
      required: true,
      min: 1,
    },
    height: {
      type: Number,
      required: true,
      min: 1,
    },
    altText: {
      type: String,
      default: null,
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// MAIN DESIGN SCHEMA
// ---------------------------------------------------------------------------

const designSchema = new mongoose.Schema(
  {
    /**
     * Canvas ID from Adobe Express
     * Used to identify the specific design in the Add-on
     */
    canvasId: {
      type: String,
      required: [true, "Canvas ID is required"],
      trim: true,
      index: true,
    },

    /**
     * Optional name for the design
     */
    name: {
      type: String,
      trim: true,
      maxlength: [200, "Name cannot exceed 200 characters"],
    },

    /**
     * Owner of this design
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    /**
     * All colors used in the design (hex values)
     */
    colorsUsed: [
      {
        type: String,
        match: [
          /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
          "Invalid hex color format",
        ],
      },
    ],

    /**
     * All fonts used in the design
     */
    fontsUsed: [
      {
        type: String,
        trim: true,
      },
    ],

    /**
     * Text content elements from the design
     */
    textContent: {
      type: [textContentSchema],
      default: [],
    },

    /**
     * Image elements from the design
     */
    images: {
      type: [imageSchema],
      default: [],
    },

    /**
     * Layout type of the design
     */
    layout: {
      type: String,
      enum: [
        "centered",
        "left-aligned",
        "right-aligned",
        "grid",
        "freeform",
        "standard",
        "unknown",
      ],
      default: "unknown",
    },

    /**
     * Canvas dimensions
     */
    dimensions: {
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
    },

    /**
     * Background color of the canvas
     */
    backgroundColor: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format"],
      default: null,
    },

    /**
     * Raw design data for reference
     * Stores the complete design data from Adobe Express
     */
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /**
     * Source of the design
     */
    source: {
      type: String,
      enum: ["adobe-express", "upload", "api"],
      default: "adobe-express",
    },

    /**
     * Status of the design
     */
    status: {
      type: String,
      enum: ["pending", "analyzed", "archived"],
      default: "pending",
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
designSchema.index({ userId: 1, status: 1 });
designSchema.index({ canvasId: 1, userId: 1 });
designSchema.index({ createdAt: -1 });

// ---------------------------------------------------------------------------
// VIRTUALS
// ---------------------------------------------------------------------------
/**
 * Get latest analysis for this design
 */
designSchema.virtual("latestAnalysis", {
  ref: "AnalysisResult",
  localField: "_id",
  foreignField: "designId",
  justOne: true,
  options: { sort: { createdAt: -1 } },
});

// ---------------------------------------------------------------------------
// STATICS
// ---------------------------------------------------------------------------
/**
 * Find designs by user with pagination
 */
designSchema.statics.findByUser = function (userId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const query = { userId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

/**
 * Find or create a design by canvas ID
 */
designSchema.statics.findOrCreateByCanvasId = async function (
  canvasId,
  designData
) {
  let design = await this.findOne({ canvasId });
  if (!design) {
    design = await this.create({ canvasId, ...designData });
  } else {
    // Update existing design with new data
    Object.assign(design, designData);
    await design.save();
  }
  return design;
};

// ---------------------------------------------------------------------------
// METHODS
// ---------------------------------------------------------------------------
/**
 * Get design summary for analysis
 */
designSchema.methods.toAnalysisInput = function () {
  return {
    canvasId: this.canvasId,
    colorsUsed: this.colorsUsed,
    fontsUsed: this.fontsUsed,
    textContent: this.textContent.map((t) => ({
      text: t.text,
      font: t.font,
      fontSize: t.fontSize,
    })),
    images: this.images.map((i) => ({
      type: i.type,
      width: i.width,
      height: i.height,
    })),
    layout: this.layout,
    backgroundColor: this.backgroundColor,
  };
};

/**
 * Get all text as a single string for tone analysis
 */
designSchema.methods.getAllText = function () {
  return this.textContent.map((t) => t.text).join(" ");
};

const Design = mongoose.model("Design", designSchema);

export default Design;
