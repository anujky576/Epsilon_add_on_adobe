/**
 * =============================================================================
 * BrandGuard AI - Server Entry Point
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This file handles server startup, database connections, and graceful shutdown.
 * The Express app configuration is separated in app.js for cleaner architecture.
 *
 * STARTUP SEQUENCE:
 * 1. Load environment variables
 * 2. Connect to MongoDB (with retry logic)
 * 3. Create Express app
 * 4. Start HTTP server
 * 5. Set up graceful shutdown handlers
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import createApp from "./app.js";
import { logger } from "./utils/logger.js";

// Load environment variables FIRST - before anything else
dotenv.config();

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/brandguard";
const NODE_ENV = process.env.NODE_ENV || "development";

// ---------------------------------------------------------------------------
// DATABASE CONNECTION
// ---------------------------------------------------------------------------
/**
 * Connect to MongoDB with retry logic
 * ARCHITECTURE DECISION: We allow the server to start even if MongoDB is not
 * available - this enables development with mock data. In production, you'd
 * want to fail fast if the database is not available.
 */
const connectDatabase = async () => {
  try {
    // Mongoose connection options
    const options = {
      // Automatically try to reconnect when connection is lost
      autoIndex: true,
      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);
    logger.info("✅ MongoDB connected successfully");
    logger.info(`   Database: ${mongoose.connection.name}`);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    return true;
  } catch (error) {
    logger.warn("⚠️  MongoDB connection failed:", error.message);
    logger.warn("   Server will start in MOCK MODE - data will not persist");
    logger.warn(
      "   To use MongoDB, ensure it is running and MONGODB_URI is correct"
    );
    return false;
  }
};

// ---------------------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ---------------------------------------------------------------------------
/**
 * Handle graceful shutdown
 * CRITICAL: Ensures database connections are properly closed and in-flight
 * requests are completed before server terminates
 */
const gracefulShutdown = async (signal, server) => {
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed");

    // Close database connection
    try {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed");
    } catch (err) {
      logger.error("Error closing MongoDB connection:", err);
    }

    logger.info("Graceful shutdown complete");
    process.exit(0);
  });

  // Force shutdown if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forced shutdown - graceful shutdown timed out");
    process.exit(1);
  }, 10000);
};

// ---------------------------------------------------------------------------
// SERVER STARTUP
// ---------------------------------------------------------------------------
const startServer = async () => {
  logger.info("=".repeat(60));
  logger.info("🚀 BrandGuard AI Backend Starting...");
  logger.info("=".repeat(60));
  logger.info(`   Environment: ${NODE_ENV}`);
  logger.info(`   Port: ${PORT}`);
  logger.info(
    `   Mock AI: ${process.env.USE_MOCK_AI === "true" ? "ENABLED" : "DISABLED"}`
  );
  logger.info("");

  // Step 1: Connect to database
  const dbConnected = await connectDatabase();

  // Step 2: Create Express app
  const app = createApp();

  // Step 3: Add database status to app for health checks
  app.locals.dbConnected = dbConnected;

  // Step 4: Start HTTP server
  const server = app.listen(PORT, () => {
    logger.info("");
    logger.info("=".repeat(60));
    logger.info("✅ BrandGuard AI Backend is READY");
    logger.info("=".repeat(60));
    logger.info(`   Local:   http://localhost:${PORT}`);
    logger.info(`   Health:  http://localhost:${PORT}/health`);
    logger.info("");
    logger.info("📡 API Endpoints:");
    logger.info(`   POST /api/brandkit        - Create brand kit`);
    logger.info(`   POST /api/design          - Submit design`);
    logger.info(`   POST /api/analysis/run    - Run brand analysis`);
    logger.info(`   POST /api/autofix/apply   - Apply auto-fixes`);
    logger.info(`   GET  /api/analytics       - Get analytics`);
    logger.info(`   POST /api/report/generate - Generate report`);
    logger.info("=".repeat(60));
  });

  // Step 5: Set up graceful shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", server));
  process.on("SIGINT", () => gracefulShutdown("SIGINT", server));

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception:", err);
    gracefulShutdown("UNCAUGHT_EXCEPTION", server);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  });
};

// Start the server
startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
