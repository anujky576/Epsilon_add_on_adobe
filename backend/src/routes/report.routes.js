/**
 * =============================================================================
 * Epsilon - Report Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes for generating and retrieving compliance reports.
 *
 * BASE PATH: /api/report
 */

import { Router } from "express";
import {
  generateReport,
  getReport,
  getFullReport,
  listReports,
  deleteReport,
} from "../controllers/report.controller.js";

const router = Router();

/**
 * @route   POST /api/report/generate
 * @desc    Generate a new compliance report
 * @access  Public
 * @body    { title, description?, brandKitId, analysisId?, dateRange? }
 * @returns { report: { id, title, brandKit, summary, analysesCount, generatedAt } }
 */
router.post("/generate", generateReport);

/**
 * @route   GET /api/report
 * @desc    List all reports with pagination
 * @access  Public
 * @query   page, limit
 */
router.get("/", listReports);

/**
 * @route   GET /api/report/:id
 * @desc    Get a report by ID
 * @access  Public
 * @param   id - Report ObjectId
 */
router.get("/:id", getReport);

/**
 * @route   GET /api/report/:id/full
 * @desc    Get a full report with all analysis details
 * @access  Public
 * @param   id - Report ObjectId
 */
router.get("/:id/full", getFullReport);

/**
 * @route   DELETE /api/report/:id
 * @desc    Delete a report
 * @access  Public
 * @param   id - Report ObjectId
 */
router.delete("/:id", deleteReport);

export default router;
