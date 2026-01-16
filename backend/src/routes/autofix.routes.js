/**
 * =============================================================================
 * BrandGuard AI - Auto-Fix Routes
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * Routes for applying and previewing automatic fixes to designs.
 *
 * BASE PATH: /api/autofix
 */

import { Router } from "express";
import {
  applyAutoFix,
  previewAutoFix,
} from "../controllers/autofix.controller.js";

const router = Router();

/**
 * @route   POST /api/autofix/apply
 * @desc    Apply auto-fixes to a design based on analysis violations
 * @access  Public
 * @body    { analysisId, designId?, fixTypes? }
 * @returns { fixedDesign, appliedFixes, skippedFixes, statistics }
 */
router.post("/apply", applyAutoFix);

/**
 * @route   POST /api/autofix/preview
 * @desc    Preview auto-fixes without applying them
 * @access  Public
 * @body    { analysisId }
 * @returns { preview, currentScore, violationsCount }
 */
router.post("/preview", previewAutoFix);

export default router;
