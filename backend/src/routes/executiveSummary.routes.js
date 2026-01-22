/**
 * =============================================================================
 * Epsilon - Executive Summary Routes
 * =============================================================================
 *
 * BASE PATH: /api/executive-summary
 */

import { Router } from "express";
import { getExecutiveSummary } from "../controllers/executiveSummary.controller.js";

const router = Router();

/**
 * @route   GET /api/executive-summary
 * @desc    Generate AI-powered executive summary for brand governance
 * @access  Public
 * @query   brandKitId - Optional: filter by brand kit
 * @query   period - Time period: 'week', 'month', 'quarter' (default: week)
 */
router.get("/", getExecutiveSummary);

export default router;
