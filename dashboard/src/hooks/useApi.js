import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook for API calls with loading and error states
 */
export function useApi(apiFunction, dependencies = [], immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFunction(...args);
        setData(result.data || result);
        return result;
      } catch (err) {
        setError(err.message || "An error occurred");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction]
  );

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [...dependencies, immediate]);

  return { data, loading, error, execute, setData };
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value, decimals = 0) {
  if (value === null || value === undefined) return "N/A";
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format a date for display
 */
export function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Get score label class
 */
export function getScoreClass(score) {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "needs-work";
  return "poor";
}

/**
 * Get score label text
 */
export function getScoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

/**
 * Get severity color class
 */
export function getSeverityClass(severity) {
  const classes = {
    critical: "text-danger",
    high: "text-warning",
    medium: "text-info",
    low: "text-muted",
  };
  return classes[severity] || "text-muted";
}
