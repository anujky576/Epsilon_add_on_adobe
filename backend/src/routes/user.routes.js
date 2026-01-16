/**
 * =============================================================================
 * BrandGuard AI - User Routes
 * =============================================================================
 *
 * Simple user authentication routes for the BrandGuard AI Add-on.
 * For hackathon purposes, this uses a simplified login flow without passwords.
 */

import express from "express";
import User from "../models/User.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

/**
 * @route   POST /api/user/login
 * @desc    Login or register a user (simplified auth)
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, name, organization } = req.body;

    if (!email || !name) {
      return res.status(400).json(errorResponse("Email and name are required"));
    }

    // Validate email format
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json(errorResponse("Invalid email format"));
    }

    // Find existing user or create new one
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Update existing user's name/org if provided
      if (name) user.name = name;
      if (organization) user.organization = organization;
      user.lastLoginAt = new Date();
      await user.save();
      logger.info(`User logged in: ${email}`);
    } else {
      // Create new user
      user = await User.create({
        email: email.toLowerCase(),
        name,
        organization: organization || "",
      });
      logger.info(`New user registered: ${email}`);
    }

    res.json(
      successResponse(
        { user: user.toJSON() },
        user.createdAt === user.updatedAt
          ? "User registered successfully"
          : "User logged in successfully"
      )
    );
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json(errorResponse("Login failed: " + error.message));
  }
});

/**
 * @route   GET /api/user/:id
 * @desc    Get user by ID
 * @access  Public (would be authenticated in production)
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    res.json(successResponse({ user: user.toJSON() }));
  } catch (error) {
    logger.error("Get user error:", error);
    res.status(500).json(errorResponse("Failed to get user: " + error.message));
  }
});

/**
 * @route   GET /api/user/email/:email
 * @desc    Get user by email
 * @access  Public (would be authenticated in production)
 */
router.get("/email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    res.json(successResponse({ user: user.toJSON() }));
  } catch (error) {
    logger.error("Get user by email error:", error);
    res.status(500).json(errorResponse("Failed to get user: " + error.message));
  }
});

/**
 * @route   PUT /api/user/:id
 * @desc    Update user profile
 * @access  Public (would be authenticated in production)
 */
router.put("/:id", async (req, res) => {
  try {
    const { name, organization, preferences } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (organization !== undefined) updateData.organization = organization;
    if (preferences) updateData.preferences = preferences;

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json(errorResponse("User not found"));
    }

    res.json(successResponse({ user: user.toJSON() }, "User updated successfully"));
  } catch (error) {
    logger.error("Update user error:", error);
    res.status(500).json(errorResponse("Failed to update user: " + error.message));
  }
});

export default router;
