/**
 * =============================================================================
 * Epsilon - Analytics Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes for retrieving aggregated analytics data.
 *
 * BASE PATH: /api/analytics
 */

import { Router } from "express";
import {
  getAnalytics,
  getQuickStats,
} from "../controllers/analytics.controller.js";

const router = Router();

/**
 * @route   GET /api/analytics
 * @desc    Get comprehensive analytics with aggregations
 * @access  Public
 * @query   startDate, endDate, brandKitId
 * @returns { overview, topViolationCategories, scoreDistribution, trend, entityCounts }
 */
router.get("/", getAnalytics);

/**
 * @route   GET /api/analytics/quick
 * @desc    Get quick stats for dashboard
 * @access  Public
 * @returns { lastAnalysis, totalDesigns, totalBrandKits, scansLast24h }
 */
router.get("/quick", getQuickStats);

export default router;
