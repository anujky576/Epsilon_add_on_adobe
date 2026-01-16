import addOnUISdk from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

/**
 * =============================================================================
 * BrandGuard AI - Adobe Express Add-on (Enterprise Edition)
 * =============================================================================
 *
 * Enterprise-grade brand governance add-on integrating with BrandGuard AI backend.
 * Features:
 * - Dynamic brand kit selection with versioning
 * - Real-time canvas data extraction
 * - AI-powered analysis with Gemini
 * - Risk scoring (Brand, Accessibility, Legal)
 * - Executive insights and recommendations
 * - Auto-fix capabilities
 */

// =============================================================================
// CONFIGURATION
// =============================================================================
const API_BASE_URL = "http://localhost:3000";

// Session state
let currentBrandKitId = null;
let currentBrandKit = null;
let currentDesignId = null;
let currentAnalysisId = null;
let currentViolations = [];
let brandKits = [];

// =============================================================================
// API HELPER FUNCTIONS
// =============================================================================

async function apiRequest(endpoint, method = "GET", data = null) {
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "API request failed");
    }

    return result.data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// =============================================================================
// BRAND KIT MANAGEMENT
// =============================================================================

async function loadBrandKits() {
  try {
    const data = await apiRequest("/api/brandkit");
    brandKits = data.brandKits || [];

    const select = document.getElementById("brandKitSelect");
    select.innerHTML = "";

    if (brandKits.length === 0) {
      // Create default brand kit
      const defaultKit = await createDefaultBrandKit();
      brandKits = [defaultKit];
    }

    brandKits.forEach((kit, index) => {
      const option = document.createElement("option");
      option.value = kit._id;
      option.textContent = `${kit.name}${
        kit.isDefault ? " (Default)" : ""
      } - v${kit.version || 1}`;
      if (index === 0) option.selected = true;
      select.appendChild(option);
    });

    // Select first brand kit
    if (brandKits.length > 0) {
      selectBrandKit(brandKits[0]._id);
    }

    return brandKits;
  } catch (error) {
    console.error("Failed to load brand kits:", error);
    document.getElementById("brandKitSelect").innerHTML =
      '<option value="">Failed to load</option>';
    throw error;
  }
}

async function createDefaultBrandKit() {
  const defaultBrandKit = {
    name: "Default Brand Kit",
    description: "Auto-generated brand kit for governance",
    colors: [
      { name: "Primary", hex: "#6366f1", tolerance: 10, usage: "primary" },
      { name: "Secondary", hex: "#0ea5e9", tolerance: 10, usage: "secondary" },
      { name: "Background", hex: "#0f172a", tolerance: 5, usage: "background" },
      { name: "Text", hex: "#f1f5f9", tolerance: 5, usage: "text" },
      { name: "Accent", hex: "#f59e0b", tolerance: 10, usage: "accent" },
    ],
    fonts: [
      { name: "Inter", usage: "heading", fallbacks: ["Roboto", "sans-serif"] },
      { name: "Roboto", usage: "body", fallbacks: ["Arial", "sans-serif"] },
    ],
    logoRules: {
      minWidth: 50,
      minHeight: 50,
      clearSpaceRatio: 0.1,
    },
    accessibilityRules: {
      minContrastRatio: 4.5,
      largeTextMinContrast: 3,
      requireAltText: true,
    },
    toneRules: {
      style: "professional",
      bannedWords: ["cheap", "free", "guarantee", "spam"],
    },
  };

  const { brandKit } = await apiRequest(
    "/api/brandkit",
    "POST",
    defaultBrandKit
  );
  return brandKit;
}

function selectBrandKit(brandKitId) {
  const kit = brandKits.find((k) => k._id === brandKitId);
  if (kit) {
    currentBrandKitId = kit._id;
    currentBrandKit = kit;

    // Update info display
    document.getElementById("brandKitInfo").classList.remove("hidden");
    document.getElementById("brandKitVersion").textContent = `v${
      kit.version || 1
    }`;
    document.getElementById("brandKitColors").textContent =
      kit.colors?.length || 0;
    document.getElementById("brandKitFonts").textContent =
      kit.fonts?.length || 0;

    console.log("Selected brand kit:", kit.name, kit._id);
  }
}

// =============================================================================
// DESIGN EXTRACTION
// =============================================================================

async function extractDesignData() {
  try {
    const { runtime } = addOnUISdk.instance;

    if (runtime?.apiProxy?.extractDesignData) {
      console.log("Extracting design data from canvas...");
      const designData = await runtime.apiProxy.extractDesignData();
      console.log("Extracted:", designData);
      return designData;
    } else {
      console.warn("Document Sandbox not available, using fallback");
      return getFallbackDesignData();
    }
  } catch (error) {
    console.error("Extraction error:", error);
    return getFallbackDesignData();
  }
}

function getFallbackDesignData() {
  return {
    canvasId: `express_canvas_${Date.now()}`,
    name: "Current Design",
    colorsUsed: ["#FFFFFF", "#000000", "#6366f1"],
    fontsUsed: ["Inter", "Roboto"],
    textContent: [{ text: "Sample text content", fontSize: 16 }],
    images: [],
    layout: "standard",
    backgroundColor: "#FFFFFF",
  };
}

async function submitDesign(designData) {
  const { design } = await apiRequest("/api/design", "POST", designData);
  currentDesignId = design._id;
  console.log("Design submitted:", currentDesignId);
  return design;
}

// =============================================================================
// ANALYSIS
// =============================================================================

async function runAnalysis() {
  if (!currentBrandKitId || !currentDesignId) {
    throw new Error("Brand kit and design must be set");
  }

  const result = await apiRequest("/api/analysis/run", "POST", {
    brandKitId: currentBrandKitId,
    designId: currentDesignId,
    useAI: true,
  });

  currentAnalysisId = result.analysisId;
  currentViolations = result.violations || [];
  console.log("Analysis complete:", result);
  return result;
}

async function applyAutoFix(violationType = null) {
  if (!currentAnalysisId) throw new Error("No analysis to fix");

  const payload = { analysisId: currentAnalysisId };
  if (violationType) {
    payload.fixTypes = [violationType];
  }

  const result = await apiRequest("/api/autofix/apply", "POST", payload);
  console.log("Auto-fix applied:", result);
  return result;
}

// =============================================================================
// UI UPDATES
// =============================================================================

function updateScoreDisplay(score, scoreLabel, violations) {
  // Animate score gauge
  const scoreRing = document.getElementById("scoreRing");
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (score / 100) * circumference;
  scoreRing.style.strokeDashoffset = offset;

  // Update score number with animation
  animateScore(0, score, 800);

  // Update badge
  const scoreBadge = document.getElementById("scoreBadge");
  const badgeStyles = {
    excellent: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      label: "Excellent",
    },
    good: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Good" },
    needs_work: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: "Needs Work",
    },
    poor: { bg: "bg-red-500/20", text: "text-red-400", label: "Poor" },
  };
  const style = badgeStyles[scoreLabel] || badgeStyles.needs_work;
  scoreBadge.className = `text-xs px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`;
  scoreBadge.textContent = style.label;

  // Update issue count
  document.getElementById("issueCount").textContent = violations.length;
}

function updateCategoryScores(categoryScores) {
  const container = document.getElementById("categoryScores");
  if (!categoryScores || !container) return;

  const categories = ["color", "typography", "logo", "accessibility", "tone"];
  const labels = ["Color", "Type", "Logo", "A11y", "Tone"];

  container.innerHTML = categories
    .map((cat, i) => {
      const catScore = categoryScores.find(
        (c) =>
          c.category === cat || (cat === "typography" && c.category === "font")
      );
      const score = catScore?.score ?? "--";
      const color =
        typeof score === "number"
          ? score >= 80
            ? "text-green-400"
            : score >= 60
            ? "text-yellow-400"
            : "text-red-400"
          : "text-slate-400";

      return `
      <div class="text-center">
        <div class="text-lg font-bold ${color}">${
        typeof score === "number" ? Math.round(score) : score
      }</div>
        <div class="text-[10px] text-slate-500">${labels[i]}</div>
      </div>
    `;
    })
    .join("");
}

function updateRiskScores(riskScores) {
  const risks = [
    { id: "brand", value: riskScores?.brandRisk || 0 },
    { id: "accessibility", value: riskScores?.accessibilityRisk || 0 },
    { id: "legal", value: riskScores?.legalRisk || 0 },
  ];

  risks.forEach((risk) => {
    const valueEl = document.getElementById(`${risk.id}Risk`);
    const barEl = document.getElementById(`${risk.id}RiskBar`);

    if (valueEl && barEl) {
      valueEl.textContent = `${Math.round(risk.value)}%`;
      barEl.style.width = `${risk.value}%`;

      const color =
        risk.value > 60
          ? "bg-red-500"
          : risk.value > 30
          ? "bg-yellow-500"
          : "bg-green-500";
      barEl.className = `risk-bar h-full ${color} rounded-full`;

      const textColor =
        risk.value > 60
          ? "text-red-400"
          : risk.value > 30
          ? "text-yellow-400"
          : "text-green-400";
      valueEl.className = `text-sm font-medium ${textColor}`;
    }
  });
}

function updateExecutiveInsight(summary, positives = []) {
  const container = document.getElementById("executiveInsight");
  const textEl = document.getElementById("insightText");

  if (container && textEl) {
    // Use the actual AI summary if available
    if (summary && typeof summary === "string" && summary.length > 10) {
      textEl.innerHTML = summary;

      // Add positives if available
      if (positives && positives.length > 0) {
        const positivesHtml = positives
          .map(
            (p) =>
              `<span class="inline-block bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px] mr-1 mt-1">✓ ${p}</span>`
          )
          .join("");
        textEl.innerHTML += `<div class="mt-2">${positivesHtml}</div>`;
      }
    } else {
      // Generate fallback insight based on violations
      const violationCount = currentViolations.length;
      const criticalCount = currentViolations.filter(
        (v) => v.severity === "critical" || v.severity === "high"
      ).length;

      let insight = "";
      if (violationCount === 0) {
        insight =
          "This design fully complies with brand guidelines. Ready for publication.";
      } else if (criticalCount > 0) {
        insight = `Found ${criticalCount} critical issue${
          criticalCount > 1 ? "s" : ""
        } requiring immediate attention.`;
      } else {
        insight = `Found ${violationCount} minor issue${
          violationCount > 1 ? "s" : ""
        }. The design is mostly compliant.`;
      }
      textEl.textContent = insight;
    }

    container.classList.remove("hidden");
  }
}

function updateViolationsList(violations) {
  const issuesList = document.getElementById("issuesList");
  if (!issuesList) return;

  issuesList.innerHTML = "";

  if (violations.length === 0) {
    issuesList.innerHTML = `
      <div class="glass rounded-xl p-4 text-center">
        <span class="text-3xl mb-2 block">✅</span>
        <p class="text-green-400 font-medium">All checks passed!</p>
        <p class="text-slate-400 text-xs mt-1">Your design follows brand guidelines</p>
      </div>
    `;
    return;
  }

  violations.forEach((violation, index) => {
    const isCritical =
      violation.severity === "critical" || violation.severity === "high";
    const bgColor = isCritical
      ? "border-red-500/30 bg-red-500/5"
      : "border-yellow-500/30 bg-yellow-500/5";
    const iconColor = isCritical
      ? "bg-red-500/20 text-red-400"
      : "bg-yellow-500/20 text-yellow-400";
    const badgeColor = isCritical
      ? "bg-red-500/20 text-red-400"
      : "bg-yellow-500/20 text-yellow-400";
    const badgeText = isCritical ? "CRITICAL" : "WARNING";

    const card = document.createElement("div");
    card.className = `rounded-xl p-3 border ${bgColor}`;
    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 ${iconColor} rounded-full flex items-center justify-center">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </div>
          <span class="font-medium text-sm text-white">${formatViolationType(
            violation.type
          )}</span>
        </div>
        <span class="text-[10px] ${badgeColor} px-2 py-0.5 rounded-full font-bold">${badgeText}</span>
      </div>
      <p class="text-xs text-slate-400 mb-2">${violation.description}</p>
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-slate-500">${formatAffectedElement(
          violation.affectedElement
        )}</span>
        ${
          violation.autoFixable
            ? `
          <button data-index="${index}" class="autofix-btn text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-1 rounded-lg font-medium hover:bg-brand-primary hover:text-white transition-colors flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Fix
          </button>
        `
            : ""
        }
      </div>
    `;
    issuesList.appendChild(card);
  });

  // Attach auto-fix handlers
  document.querySelectorAll(".autofix-btn").forEach((btn) => {
    btn.addEventListener("click", handleAutoFix);
  });
}

// =============================================================================
// UTILITIES
// =============================================================================

function formatViolationType(type) {
  const labels = {
    color: "Color Mismatch",
    font: "Typography Issue",
    logo: "Logo Violation",
    accessibility: "Accessibility Issue",
    tone: "Tone/Language Issue",
    spacing: "Spacing Issue",
    layout: "Layout Issue",
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function formatAffectedElement(element) {
  if (typeof element === "string") {
    return element.length > 25 ? element.substring(0, 25) + "..." : element;
  }
  if (typeof element === "object") {
    return JSON.stringify(element).substring(0, 25) + "...";
  }
  return String(element);
}

function animateScore(start, end, duration) {
  const scoreElement = document.getElementById("scoreValue");
  if (!scoreElement) return;

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * easeProgress);

    scoreElement.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

async function handleAutoFix(e) {
  const btn = e.currentTarget;
  const originalHTML = btn.innerHTML;

  btn.innerHTML =
    '<svg class="w-3 h-3 loading-spinner" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>';
  btn.disabled = true;

  try {
    await applyAutoFix();
    btn.innerHTML = "✓ Fixed";
    btn.classList.add("bg-green-500/20", "text-green-400");
    btn.classList.remove("bg-brand-primary/20", "text-brand-primary");
  } catch (error) {
    btn.innerHTML = "✕ Failed";
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 2000);
  }
}

// =============================================================================
// MAIN INITIALIZATION
// =============================================================================

addOnUISdk.ready.then(() => {
  console.log("🛡️ BrandGuard AI Enterprise Add-on Ready");
  console.log(`📡 Backend: ${API_BASE_URL}`);

  // DOM Elements
  const uploadSection = document.getElementById("uploadSection");
  const resultsSection = document.getElementById("resultsSection");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const reAnalyzeBtn = document.getElementById("reAnalyzeBtn");
  const autoFixAllBtn = document.getElementById("autoFixAllBtn");
  const brandKitSelect = document.getElementById("brandKitSelect");
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const backendStatus = document.getElementById("backendStatus");

  // Check backend health
  fetch(`${API_BASE_URL}/health`)
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        backendStatus.textContent = "Connected";
        backendStatus.className =
          "text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400";
        loadBrandKits();
      }
    })
    .catch(() => {
      backendStatus.textContent = "Offline";
      backendStatus.className =
        "text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400";
    });

  // Brand kit selection
  brandKitSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      selectBrandKit(e.target.value);
    }
  });

  // Analyze button
  analyzeBtn.addEventListener("click", runFullAnalysis);
  reAnalyzeBtn?.addEventListener("click", () => {
    resultsSection.classList.add("hidden");
    uploadSection.classList.remove("hidden");
    currentDesignId = null;
    currentAnalysisId = null;
    currentViolations = [];
  });

  // Auto-fix all
  autoFixAllBtn?.addEventListener("click", async () => {
    autoFixAllBtn.disabled = true;
    autoFixAllBtn.innerHTML =
      '<svg class="w-4 h-4 loading-spinner" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle></svg> Fixing...';

    try {
      await applyAutoFix();
      autoFixAllBtn.innerHTML = "✓ All Fixed";
      autoFixAllBtn.classList.remove(
        "from-brand-primary",
        "to-brand-secondary"
      );
      autoFixAllBtn.classList.add("bg-green-500");
    } catch (error) {
      autoFixAllBtn.innerHTML = "Fix Failed";
    }
  });

  // Drag and drop
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      false
    );
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) runFullAnalysis();
  });

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) runFullAnalysis();
  });

  async function runFullAnalysis() {
    analyzeBtn.innerHTML =
      '<svg class="w-5 h-5 loading-spinner" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing...';
    analyzeBtn.disabled = true;

    try {
      // Ensure brand kit is selected
      if (!currentBrandKitId && brandKits.length > 0) {
        selectBrandKit(brandKits[0]._id);
      }

      // Extract and submit design
      const designData = await extractDesignData();
      await submitDesign(designData);

      // Run analysis
      const result = await runAnalysis();

      // Calculate risk scores based on violations
      const riskScores = calculateRiskScores(result.violations);

      // Show results
      showResults(result, riskScores);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. Ensure backend is running at " + API_BASE_URL);
    } finally {
      analyzeBtn.innerHTML =
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg> Analyze Current Design';
      analyzeBtn.disabled = false;
    }
  }

  function calculateRiskScores(violations) {
    let brandRisk = 0,
      accessibilityRisk = 0,
      legalRisk = 0;

    violations.forEach((v) => {
      const weight =
        v.severity === "critical" ? 25 : v.severity === "high" ? 15 : 8;

      if (v.type === "color" || v.type === "font" || v.type === "logo") {
        brandRisk += weight;
      }
      if (v.type === "accessibility") {
        accessibilityRisk += weight;
        legalRisk += weight * 0.5; // Accessibility issues have legal implications
      }
      if (v.type === "logo" || v.type === "tone") {
        legalRisk += weight * 0.3;
      }
    });

    return {
      brandRisk: Math.min(100, brandRisk),
      accessibilityRisk: Math.min(100, accessibilityRisk),
      legalRisk: Math.min(100, legalRisk),
    };
  }

  function showResults(analysisResult, riskScores) {
    uploadSection.classList.add("hidden");
    resultsSection.classList.remove("hidden");

    updateScoreDisplay(
      analysisResult.complianceScore,
      analysisResult.scoreLabel,
      analysisResult.violations
    );
    updateCategoryScores(analysisResult.categoryScores);
    updateRiskScores(riskScores);
    updateViolationsList(analysisResult.violations);
    updateExecutiveInsight(analysisResult.summary, analysisResult.positives);
  }
});
