/**
 * =============================================================================
 * Epsilon - Express Application Configuration
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This file is responsible ONLY for Express app configuration. Server startup
 * and database connections are handled in server.js. This separation allows
 * for easier testing and cleaner dependency management.
 *
 * MIDDLEWARE ORDER:
 * 1. Security (helmet) - Sets security headers
 * 2. CORS - Handles cross-origin requests from Adobe Express Add-on
 * 3. Logging (morgan) - Request logging for debugging
 * 4. Body parsing - JSON request body parsing
 * 5. Routes - API endpoint handlers
 * 6. Error handling - Centralized error response formatting
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Route imports
import brandKitRoutes from "./routes/brandKit.routes.js";
import designRoutes from "./routes/design.routes.js";
import analysisRoutes from "./routes/analysis.routes.js";
import autofixRoutes from "./routes/autofix.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import reportRoutes from "./routes/report.routes.js";
import executiveSummaryRoutes from "./routes/executiveSummary.routes.js";
import userRoutes from "./routes/user.routes.js";

// Utility imports
import { errorResponse } from "./utils/response.js";
import { logger } from "./utils/logger.js";

/**
 * Create and configure Express application
 * @returns {Express.Application} Configured Express app
 */
const createApp = () => {
  const app = express();

  // ---------------------------------------------------------------------------
  // SECURITY MIDDLEWARE
  // ---------------------------------------------------------------------------
  // Helmet sets various HTTP headers to help protect the app
  app.use(
    helmet({
      // Allow cross-origin requests for Adobe Express Add-on
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // ---------------------------------------------------------------------------
  // CORS CONFIGURATION
  // ---------------------------------------------------------------------------
  // CRITICAL: Adobe Express Add-on runs in a sandboxed iframe and needs CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://new.express.adobe.com",
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked request from: ${origin}`);
          callback(null, true); // In development, allow all origins
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    })
  );

  // ---------------------------------------------------------------------------
  // REQUEST LOGGING
  // ---------------------------------------------------------------------------
  // Morgan for HTTP request logging in development
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // ---------------------------------------------------------------------------
  // BODY PARSING
  // ---------------------------------------------------------------------------
  // Parse JSON bodies - limit to 10MB for design data with images
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ---------------------------------------------------------------------------
  // REQUEST ID MIDDLEWARE
  // ---------------------------------------------------------------------------
  // Add unique request ID for tracing
  app.use((req, res, next) => {
    req.requestId =
      req.headers["x-request-id"] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader("X-Request-ID", req.requestId);
    next();
  });

  // ---------------------------------------------------------------------------
  // HEALTH CHECK ENDPOINT
  // ---------------------------------------------------------------------------
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      data: {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      message: "Epsilon Backend is running",
    });
  });

  // ---------------------------------------------------------------------------
  // API ROUTES
  // ---------------------------------------------------------------------------
  // All routes are prefixed with /api for clear separation
  app.use("/api/user", userRoutes);
  app.use("/api/brandkit", brandKitRoutes);
  app.use("/api/design", designRoutes);
  app.use("/api/designs", designRoutes); // Alias for listing
  app.use("/api/analysis", analysisRoutes);
  app.use("/api/autofix", autofixRoutes);
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/report", reportRoutes);
  app.use("/api/executive-summary", executiveSummaryRoutes);

  // ---------------------------------------------------------------------------
  // 404 HANDLER
  // ---------------------------------------------------------------------------
  app.use((req, res) => {
    res
      .status(404)
      .json(errorResponse(`Route not found: ${req.method} ${req.path}`));
  });

  // ---------------------------------------------------------------------------
  // GLOBAL ERROR HANDLER
  // ---------------------------------------------------------------------------
  // ARCHITECTURE DECISION: Centralized error handling ensures consistent
  // error response format across all endpoints
  app.use((err, req, res, next) => {
    logger.error(`Error in ${req.method} ${req.path}:`, err);

    // Mongoose validation errors
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res
        .status(400)
        .json(errorResponse(`Validation failed: ${messages.join(", ")}`));
    }

    // Mongoose cast errors (invalid ObjectId)
    if (err.name === "CastError") {
      return res
        .status(400)
        .json(errorResponse(`Invalid ${err.path}: ${err.value}`));
    }

    // Default to 500 internal server error
    const statusCode = err.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message;

    res.status(statusCode).json(errorResponse(message));
  });

  return app;
};

export default createApp;
