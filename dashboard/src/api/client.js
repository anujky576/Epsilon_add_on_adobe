/**
 * BrandGuard AI - API Client
 * Centralized API communication with the backend
 */

const API_BASE_URL = "http://localhost:3000/api";

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "API request failed");
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Brand Kit API
 */
export const brandKitAPI = {
  list: () => apiRequest("/brandkit"),
  get: (id) => apiRequest(`/brandkit/${id}`),
  create: (data) =>
    apiRequest("/brandkit", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data, changeNote = "") =>
    apiRequest(`/brandkit/${id}?changeNote=${encodeURIComponent(changeNote)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id) => apiRequest(`/brandkit/${id}`, { method: "DELETE" }),
  getVersions: (id) => apiRequest(`/brandkit/${id}/versions`),
  getVersion: (id, version) => apiRequest(`/brandkit/${id}/version/${version}`),
};

/**
 * Analysis API
 */
export const analysisAPI = {
  run: (brandKitId, designId, useAI = true) =>
    apiRequest("/analysis/run", {
      method: "POST",
      body: JSON.stringify({ brandKitId, designId, useAI }),
    }),
  get: (id) => apiRequest(`/analysis/${id}`),
  history: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/analysis/history${query ? `?${query}` : ""}`);
  },
};

/**
 * Analytics API
 */
export const analyticsAPI = {
  get: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/analytics${query ? `?${query}` : ""}`);
  },
  quick: () => apiRequest("/analytics/quick"),
};

/**
 * Reports API
 */
export const reportsAPI = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/report${query ? `?${query}` : ""}`);
  },
  get: (id) => apiRequest(`/report/${id}`),
  getFull: (id) => apiRequest(`/report/${id}/full`),
  generate: (data) =>
    apiRequest("/report/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id) => apiRequest(`/report/${id}`, { method: "DELETE" }),
};

/**
 * Executive Summary API
 */
export const executiveSummaryAPI = {
  get: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/executive-summary${query ? `?${query}` : ""}`);
  },
};

/**
 * Auto-fix API
 */
export const autoFixAPI = {
  apply: (data) =>
    apiRequest("/autofix/apply", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  preview: (analysisId) =>
    apiRequest("/autofix/preview", {
      method: "POST",
      body: JSON.stringify({ analysisId }),
    }),
};

/**
 * Designs API
 */
export const designsAPI = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/designs${query ? `?${query}` : ""}`);
  },
  get: (id) => apiRequest(`/design/${id}`),
  upload: (data) =>
    apiRequest("/design/upload", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export default {
  brandKit: brandKitAPI,
  analysis: analysisAPI,
  analytics: analyticsAPI,
  reports: reportsAPI,
  executiveSummary: executiveSummaryAPI,
  autoFix: autoFixAPI,
  designs: designsAPI,
};
