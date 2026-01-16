/**
 * =============================================================================
 * BrandGuard AI - Brand Kit Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Controllers handle HTTP request/response orchestration only.
 * All business logic is delegated to services.
 *
 * ENDPOINTS:
 * - POST   /api/brandkit     - Create new brand kit
 * - GET    /api/brandkit/:id - Get brand kit by ID
 * - PUT    /api/brandkit/:id - Update brand kit
 * - DELETE /api/brandkit/:id - Delete brand kit (soft delete)
 * - GET    /api/brandkit     - List all brand kits
 */

import BrandKit from "../models/BrandKit.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Create a new brand kit
 *
 * @route POST /api/brandkit
 * @body {Object} Brand kit data (name, colors, fonts, logoRules, etc.)
 */
export const createBrandKit = async (req, res, next) => {
  try {
    const brandKitData = req.body;

    // Validate required fields
    if (!brandKitData.name) {
      return res.status(400).json(errorResponse("Brand kit name is required"));
    }

    if (!brandKitData.colors || brandKitData.colors.length === 0) {
      return res
        .status(400)
        .json(errorResponse("At least one color is required"));
    }

    if (!brandKitData.fonts || brandKitData.fonts.length === 0) {
      return res
        .status(400)
        .json(errorResponse("At least one font is required"));
    }

    // Create brand kit
    const brandKit = new BrandKit(brandKitData);
    await brandKit.save();

    logger.info(`Brand kit created: ${brandKit._id} - ${brandKit.name}`);

    res
      .status(201)
      .json(successResponse({ brandKit }, "Brand kit created successfully"));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a brand kit by ID
 *
 * @route GET /api/brandkit/:id
 * @param {string} id - Brand kit ID
 */
export const getBrandKit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brandKit = await BrandKit.findById(id);

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    if (brandKit.isArchived) {
      return res.status(404).json(errorResponse("Brand kit has been archived"));
    }

    res.json(successResponse({ brandKit }, "Brand kit retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

/**
 * Update a brand kit
 *
 * @route PUT /api/brandkit/:id
 * @param {string} id - Brand kit ID
 * @body {Object} Updated brand kit data
 */
export const updateBrandKit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const { changeNote = "" } = req.query;

    // Fetch current brand kit first
    const brandKit = await BrandKit.findById(id);

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    if (brandKit.isArchived) {
      return res
        .status(400)
        .json(errorResponse("Cannot update archived brand kit"));
    }

    // Create version snapshot before updating
    brandKit.createVersionSnapshot(changeNote);

    // Prevent updating certain fields
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.version;
    delete updateData.versionHistory;

    // Apply updates
    Object.assign(brandKit, updateData);
    await brandKit.save();

    logger.info(
      `Brand kit updated: ${brandKit._id} (now v${brandKit.version})`
    );

    res.json(
      successResponse(
        { brandKit },
        `Brand kit updated to version ${brandKit.version}`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get version history for a brand kit
 *
 * @route GET /api/brandkit/:id/versions
 * @param {string} id - Brand kit ID
 */
export const getBrandKitVersions = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brandKit = await BrandKit.findById(id).select(
      "name version versionHistory"
    );

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    const versions = [
      ...brandKit.versionHistory.map((v) => ({
        version: v.version,
        changedAt: v.changedAt,
        changeNote: v.changeNote,
        isCurrent: false,
      })),
      {
        version: brandKit.version,
        changedAt: brandKit.updatedAt || new Date(),
        changeNote: "Current version",
        isCurrent: true,
      },
    ].sort((a, b) => b.version - a.version);

    res.json(
      successResponse(
        {
          brandKitId: brandKit._id,
          name: brandKit.name,
          currentVersion: brandKit.version,
          versions,
        },
        "Version history retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific version of a brand kit
 *
 * @route GET /api/brandkit/:id/version/:version
 * @param {string} id - Brand kit ID
 * @param {number} version - Version number
 */
export const getBrandKitVersion = async (req, res, next) => {
  try {
    const { id, version } = req.params;
    const versionNum = parseInt(version);

    const brandKit = await BrandKit.findById(id);

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    const versionData = brandKit.getVersion(versionNum);

    if (!versionData) {
      return res
        .status(404)
        .json(errorResponse(`Version ${versionNum} not found`));
    }

    res.json(
      successResponse(
        {
          brandKitId: brandKit._id,
          name: brandKit.name,
          requestedVersion: versionNum,
          currentVersion: brandKit.version,
          data: versionData,
        },
        `Version ${versionNum} retrieved successfully`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a brand kit (soft delete)
 *
 * @route DELETE /api/brandkit/:id
 * @param {string} id - Brand kit ID
 */
export const deleteBrandKit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const brandKit = await BrandKit.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );

    if (!brandKit) {
      return res.status(404).json(errorResponse("Brand kit not found"));
    }

    logger.info(`Brand kit archived: ${brandKit._id}`);

    res.json(
      successResponse({ brandKitId: id }, "Brand kit archived successfully")
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List all brand kits
 *
 * @route GET /api/brandkit
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 */
export const listBrandKits = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { isArchived: false };

    const [brandKits, total] = await Promise.all([
      BrandKit.find(query)
        .sort({ isDefault: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BrandKit.countDocuments(query),
    ]);

    res.json(
      successResponse(
        {
          brandKits,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Brand kits retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

export default {
  createBrandKit,
  getBrandKit,
  updateBrandKit,
  deleteBrandKit,
  listBrandKits,
  getBrandKitVersions,
  getBrandKitVersion,
};
