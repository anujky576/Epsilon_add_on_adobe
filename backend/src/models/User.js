/**
 * =============================================================================
 * BrandGuard AI - User Model
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Simple user model for multi-tenancy support. In a full production system,
 * this would include authentication, roles, and team management. For the
 * hackathon, we keep it minimal but extensible.
 *
 * USAGE:
 * Users own Brand Kits and Designs. This allows for data isolation and
 * personalized analytics per user/organization.
 */

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /**
     * User's email address - primary identifier
     */
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },

    /**
     * User's display name
     */
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    /**
     * Organization or company name
     */
    organization: {
      type: String,
      trim: true,
      maxlength: [200, "Organization name cannot exceed 200 characters"],
    },

    /**
     * User's role for future authorization
     * EXTENSION POINT: Add more roles as needed
     */
    role: {
      type: String,
      enum: ["user", "admin", "enterprise"],
      default: "user",
    },

    /**
     * Account status
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * External ID from Adobe Express (if using Adobe auth)
     */
    adobeExpressId: {
      type: String,
      sparse: true,
    },

    /**
     * User preferences and settings
     */
    preferences: {
      defaultBrandKitId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BrandKit",
      },
      notifications: {
        type: Boolean,
        default: true,
      },
    },

    /**
     * Last login timestamp
     */
    lastLoginAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// INDEXES
// ---------------------------------------------------------------------------
userSchema.index({ email: 1 });
userSchema.index({ organization: 1 });
userSchema.index({ adobeExpressId: 1 });

// ---------------------------------------------------------------------------
// VIRTUALS
// ---------------------------------------------------------------------------
/**
 * Virtual for getting the user's brand kits count
 * USAGE: await user.populate('brandKitsCount')
 */
userSchema.virtual("brandKits", {
  ref: "BrandKit",
  localField: "_id",
  foreignField: "userId",
});

// ---------------------------------------------------------------------------
// METHODS
// ---------------------------------------------------------------------------
/**
 * Get user's safe public profile (excludes sensitive data)
 */
userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    organization: this.organization,
    role: this.role,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model("User", userSchema);

export default User;
