/**
 * =============================================================================
 * BrandGuard AI - Analysis Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes for running brand compliance analysis.
 * The main endpoint POST /api/analysis/run triggers the full analysis pipeline.
 *
 * BASE PATH: /api/analysis
 */

import { Router } from "express";
import {
  runAnalysis,
  getAnalysis,
  getAnalysisHistory,
} from "../controllers/analysis.controller.js";

const router = Router();

/**
 * @route   POST /api/analysis/run
 * @desc    Run brand compliance analysis on a design
 * @access  Public
 * @body    { brandKitId, designId, useAI? }
 * @returns { analysisId, complianceScore, violations, categoryScores, summary }
 */
router.post("/run", runAnalysis);

/**
 * @route   GET /api/analysis/history
 * @desc    Get analysis history with filters
 * @access  Public
 * @query   designId, brandKitId, page, limit
 */
router.get("/history", getAnalysisHistory);

/**
 * @route   GET /api/analysis/:id
 * @desc    Get a single analysis result by ID
 * @access  Public
 * @param   id - Analysis result ObjectId
 */
router.get("/:id", getAnalysis);

export default router;
