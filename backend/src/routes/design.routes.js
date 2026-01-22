/**
 * =============================================================================
 * Epsilon - Design Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes for design submission and retrieval.
 * Primary endpoint is POST for receiving canvas data from Adobe Express Add-on.
 *
 * BASE PATH: /api/design
 */

import { Router } from "express";
import {
  submitDesign,
  getDesign,
  getDesignByCanvasId,
  listDesigns,
  deleteDesign,
} from "../controllers/design.controller.js";

const router = Router();

/**
 * @route   POST /api/design
 * @desc    Submit a new design from Adobe Express
 * @access  Public
 * @body    { canvasId, colorsUsed, fontsUsed, textContent, images, layout }
 */
router.post("/", submitDesign);

/**
 * @route   GET /api/design
 * @alias   GET /api/designs
 * @desc    List all designs with pagination
 * @access  Public
 * @query   page, limit, status
 */
router.get("/", listDesigns);

/**
 * @route   GET /api/design/:id
 * @desc    Get a single design by ID
 * @access  Public
 * @param   id - Design ObjectId
 */
router.get("/:id", getDesign);

/**
 * @route   GET /api/design/canvas/:canvasId
 * @desc    Get a design by Adobe Express canvas ID
 * @access  Public
 * @param   canvasId - Adobe Express canvas ID
 */
router.get("/canvas/:canvasId", getDesignByCanvasId);

/**
 * @route   DELETE /api/design/:id
 * @desc    Archive a design
 * @access  Public
 * @param   id - Design ObjectId
 */
router.delete("/:id", deleteDesign);

export default router;
