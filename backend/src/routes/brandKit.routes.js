/**
 * =============================================================================
 * BrandGuard AI - Brand Kit Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes define API endpoints and map them to controllers.
 * No business logic here - just routing and basic input validation middleware.
 *
 * BASE PATH: /api/brandkit
 */

import { Router } from "express";
import {
  createBrandKit,
  getBrandKit,
  updateBrandKit,
  deleteBrandKit,
  listBrandKits,
  getBrandKitVersions,
  getBrandKitVersion,
} from "../controllers/brandKit.controller.js";
import { extractBrandKit } from "../controllers/brandKitExtract.controller.js";

const router = Router();

/**
 * @route   POST /api/brandkit/extract
 * @desc    Extract brand kit from uploaded file using AI
 * @access  Public
 * @body    { fileName, fileType, fileData }
 */
router.post("/extract", extractBrandKit);

/**
 * @route   POST /api/brandkit
 * @desc    Create a new brand kit
 * @access  Public (for hackathon - would be authenticated in production)
 * @body    { name, colors, fonts, logoRules, accessibilityRules, toneRules }
 */
router.post("/", createBrandKit);

/**
 * @route   GET /api/brandkit
 * @desc    List all brand kits with pagination
 * @access  Public
 * @query   page, limit
 */
router.get("/", listBrandKits);

/**
 * @route   GET /api/brandkit/:id
 * @desc    Get a single brand kit by ID
 * @access  Public
 * @param   id - Brand kit ObjectId
 */
router.get("/:id", getBrandKit);

/**
 * @route   GET /api/brandkit/:id/versions
 * @desc    Get version history for a brand kit
 * @access  Public
 * @param   id - Brand kit ObjectId
 */
router.get("/:id/versions", getBrandKitVersions);

/**
 * @route   GET /api/brandkit/:id/version/:version
 * @desc    Get a specific version of a brand kit
 * @access  Public
 * @param   id - Brand kit ObjectId
 * @param   version - Version number
 */
router.get("/:id/version/:version", getBrandKitVersion);

/**
 * @route   PUT /api/brandkit/:id
 * @desc    Update a brand kit (creates version snapshot)
 * @access  Public
 * @param   id - Brand kit ObjectId
 * @query   changeNote - Optional note describing the change
 * @body    { name?, colors?, fonts?, logoRules?, accessibilityRules?, toneRules? }
 */
router.put("/:id", updateBrandKit);

/**
 * @route   DELETE /api/brandkit/:id
 * @desc    Delete (archive) a brand kit
 * @access  Public
 * @param   id - Brand kit ObjectId
 */
router.delete("/:id", deleteBrandKit);

export default router;
