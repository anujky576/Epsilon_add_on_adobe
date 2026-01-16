/**
 * =============================================================================
 * BrandGuard AI - Design Controller
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This controller handles design submissions from Adobe Express Add-on.
 * The Add-on sends canvas data in JSON format which is stored for analysis.
 *
 * ENDPOINTS:
 * - POST /api/design     - Submit new design (from Adobe Express)
 * - GET  /api/design/:id - Get design by ID
 * - GET  /api/designs    - List all designs
 */

import Design from "../models/Design.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

/**
 * Submit a new design (from Adobe Express Add-on)
 *
 * @route POST /api/design
 * @body {Object} Design data from Adobe Express canvas
 *        - canvasId: string
 *        - colorsUsed: string[]
 *        - fontsUsed: string[]
 *        - textContent: array
 *        - images: array
 *        - layout: string
 */
export const submitDesign = async (req, res, next) => {
  try {
    const designData = req.body;

    // Validate required fields
    if (!designData.canvasId) {
      return res.status(400).json(errorResponse("Canvas ID is required"));
    }

    // Check if design with same canvasId exists
    let design = await Design.findOne({ canvasId: designData.canvasId });

    if (design) {
      // Update existing design
      Object.assign(design, {
        ...designData,
        status: "pending", // Reset status for re-analysis
        rawData: designData, // Store raw data for reference
      });
      await design.save();

      logger.info(`Design updated: ${design._id} (canvas: ${design.canvasId})`);

      res.json(
        successResponse(
          { design, isUpdate: true },
          "Design updated successfully"
        )
      );
    } else {
      // Create new design
      design = new Design({
        ...designData,
        rawData: designData,
        source: "adobe-express",
      });
      await design.save();

      logger.info(
        `Design submitted: ${design._id} (canvas: ${design.canvasId})`
      );

      res
        .status(201)
        .json(
          successResponse(
            { design, isUpdate: false },
            "Design submitted successfully"
          )
        );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get a design by ID
 *
 * @route GET /api/design/:id
 * @param {string} id - Design ID
 */
export const getDesign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const design = await Design.findById(id);

    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    res.json(successResponse({ design }, "Design retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a design by canvas ID
 *
 * @route GET /api/design/canvas/:canvasId
 * @param {string} canvasId - Adobe Express canvas ID
 */
export const getDesignByCanvasId = async (req, res, next) => {
  try {
    const { canvasId } = req.params;

    const design = await Design.findOne({ canvasId });

    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    res.json(successResponse({ design }, "Design retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

/**
 * List all designs
 *
 * @route GET /api/designs
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10)
 * @query {string} status - Filter by status (pending, analyzed, archived)
 */
export const listDesigns = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = {};
    if (status) {
      query.status = status;
    }

    const [designs, total] = await Promise.all([
      Design.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-rawData"), // Exclude raw data from list
      Design.countDocuments(query),
    ]);

    res.json(
      successResponse(
        {
          designs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
        "Designs retrieved successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a design
 *
 * @route DELETE /api/design/:id
 * @param {string} id - Design ID
 */
export const deleteDesign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const design = await Design.findByIdAndUpdate(
      id,
      { status: "archived" },
      { new: true }
    );

    if (!design) {
      return res.status(404).json(errorResponse("Design not found"));
    }

    logger.info(`Design archived: ${design._id}`);

    res.json(successResponse({ designId: id }, "Design archived successfully"));
  } catch (error) {
    next(error);
  }
};

export default {
  submitDesign,
  getDesign,
  getDesignByCanvasId,
  listDesigns,
  deleteDesign,
};
