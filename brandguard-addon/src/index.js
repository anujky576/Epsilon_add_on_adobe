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
let currentUser = null;
let uploadedDesignFile = null;

// =============================================================================
// AUTHENTICATION
// =============================================================================

function getStoredUser() {
  try {
    const userData = localStorage.getItem("brandguard_user");
    if (userData) {
      return JSON.parse(userData);
    }
  } catch (e) {
    console.error("Failed to parse stored user:", e);
  }
  return null;
}

function storeUser(user) {
  localStorage.setItem("brandguard_user", JSON.stringify(user));
  currentUser = user;
}

function clearStoredUser() {
  localStorage.removeItem("brandguard_user");
  currentUser = null;
}

async function loginUser(email, name, organization) {
  // First, try to find existing user or create new one
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, organization }),
    });

    const result = await response.json();
    if (result.success) {
      return result.data.user;
    }
  } catch (e) {
    console.log("Backend login not available, using local auth");
  }

  // Fallback: Create local user session
  return {
    _id: `local_${Date.now()}`,
    email,
    name,
    organization,
    isLocal: true,
    createdAt: new Date().toISOString(),
  };
}

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = "257641320688-smsgtgm2v8eg9k44m97pvvt196s9mn01.apps.googleusercontent.com"; // Replace with your Google Client ID

async function initGoogleAuth() {
  // Load Google Identity Services script
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }
    
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function handleGoogleSignIn() {
  try {
    await initGoogleAuth();
    
    // Use Google Identity Services
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
    });
    
    // Prompt user to sign in
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: Use popup
        google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "email profile",
          callback: async (response) => {
            if (response.access_token) {
              await fetchGoogleUserInfo(response.access_token);
            }
          },
        }).requestAccessToken();
      }
    });
  } catch (error) {
    console.error("Google Sign-In error:", error);
    // Fallback to simple email input for demo
    const email = prompt("Enter your Google email:");
    if (email && email.includes("@")) {
      const name = email.split("@")[0];
      const user = await loginUser(email, name, "");
      user.authProvider = "google";
      storeUser(user);
      showUploadSection();
    }
  }
}

async function handleGoogleCredentialResponse(response) {
  try {
    // Decode JWT token to get user info
    const payload = JSON.parse(atob(response.credential.split(".")[1]));
    
    const user = await loginUser(payload.email, payload.name, "");
    user.authProvider = "google";
    user.picture = payload.picture;
    storeUser(user);
    showUploadSection();
  } catch (error) {
    console.error("Error processing Google credential:", error);
  }
}

async function fetchGoogleUserInfo(accessToken) {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    
    const user = await loginUser(data.email, data.name, "");
    user.authProvider = "google";
    user.picture = data.picture;
    storeUser(user);
    showUploadSection();
  } catch (error) {
    console.error("Error fetching Google user info:", error);
  }
}

function showLoginSection() {
  document.getElementById("loginSection").classList.remove("hidden");
  document.getElementById("uploadSection").classList.add("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("profileBtn").classList.add("hidden");
}

function showUploadSection() {
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("uploadSection").classList.remove("hidden");
  document.getElementById("resultsSection").classList.add("hidden");
  document.getElementById("profileBtn").classList.remove("hidden");
  document.getElementById("profileBtn").classList.add("flex");
}

function handleSignout() {
  clearStoredUser();
  showLoginSection();
  // Reset state
  currentBrandKitId = null;
  currentBrandKit = null;
  currentDesignId = null;
  currentAnalysisId = null;
  currentViolations = [];
}

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
      // No brand kits exist - prompt user to create one via dashboard
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No brand kits found - Create one in Dashboard";
      select.appendChild(option);
      
      // Hide brand kit info and disable analyze button
      document.getElementById("brandKitInfo").classList.add("hidden");
      document.getElementById("analyzeBtn").disabled = true;
      document.getElementById("analyzeBtn").classList.add("opacity-50", "cursor-not-allowed");
      
      return brandKits;
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

    // Enable analyze button
    document.getElementById("analyzeBtn").disabled = false;
    document.getElementById("analyzeBtn").classList.remove("opacity-50", "cursor-not-allowed");

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

// NOTE: Default brand kit creation removed - users should create brand kits via Dashboard
// This ensures only real, user-uploaded brand kits are used for analysis

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
    const sdk = addOnUISdk.instance;
    
    // If user uploaded a design file, include that info
    let uploadedFileInfo = null;
    if (uploadedDesignFile) {
      uploadedFileInfo = {
        name: uploadedDesignFile.name,
        type: uploadedDesignFile.type,
        size: uploadedDesignFile.size,
      };
    }

    // Try multiple ways to access the Document Sandbox API
    let designData = null;
    
    // Method 1: runtime.apiProxy (preferred - Document Sandbox)
    if (sdk.runtime?.apiProxy?.extractDesignData) {
      console.log("Using runtime.apiProxy.extractDesignData...");
      designData = await sdk.runtime.apiProxy.extractDesignData();
    }
    // Method 2: app.document API (direct canvas access)
    else if (sdk.app?.document) {
      console.log("Using app.document API for direct extraction...");
      try {
        const document = sdk.app.document;
        const pages = document.pages;
        const currentPage = pages.length > 0 ? pages[0] : null;
        
        if (currentPage) {
          const artboards = currentPage.artboards || [];
          const colorsUsed = new Set();
          const fontsUsed = new Set();
          const textContent = [];
          const images = [];
          
          // Extract data from artboards
          for (const artboard of artboards) {
            // Extract text and typography
            const textNodes = artboard.allChildren?.filter(node => node.type === 'text') || [];
            for (const textNode of textNodes) {
              if (textNode.text) {
                textContent.push({
                  text: textNode.text,
                  fontSize: textNode.fontSize || 16,
                  fontFamily: textNode.fontFamily || 'Unknown'
                });
                if (textNode.fontFamily) fontsUsed.add(textNode.fontFamily);
              }
              if (textNode.fill?.color) {
                colorsUsed.add(textNode.fill.color);
              }
            }
            
            // Extract shapes and colors
            const shapeNodes = artboard.allChildren?.filter(node => 
              node.type === 'rectangle' || node.type === 'ellipse' || node.type === 'path'
            ) || [];
            for (const shape of shapeNodes) {
              if (shape.fill?.color) colorsUsed.add(shape.fill.color);
              if (shape.stroke?.color) colorsUsed.add(shape.stroke.color);
            }
            
            // Extract images
            const imageNodes = artboard.allChildren?.filter(node => node.type === 'image') || [];
            for (const img of imageNodes) {
              images.push({
                width: img.width || 0,
                height: img.height || 0,
                url: img.href || null
              });
            }
          }
          
          designData = {
            canvasId: currentPage.id || `express_canvas_${Date.now()}`,
            name: document.title || currentPage.name || "Current Design",
            colorsUsed: Array.from(colorsUsed),
            fontsUsed: Array.from(fontsUsed),
            textContent: textContent,
            images: images,
            layout: artboards.length > 0 ? artboards[0].name : "standard",
            backgroundColor: artboards[0]?.fill?.color || "#FFFFFF",
            artboardCount: artboards.length
          };
          console.log("Extracted design data from app.document:", designData);
        }
      } catch (docError) {
        console.error("Error accessing document API:", docError);
      }
    }
    // Method 3: Direct runtime access (legacy)
    else if (sdk.runtime?.extractDesignData) {
      console.log("Using runtime.extractDesignData...");
      designData = await sdk.runtime.extractDesignData();
    }

    if (designData) {
      if (uploadedFileInfo) {
        designData.uploadedFile = uploadedFileInfo;
      }
      console.log("Successfully extracted design data:", designData);
      return designData;
    } else {
      console.warn("Document Sandbox not available - using fallback data");
      console.warn("⚠️ For full canvas extraction, ensure:");
      console.warn("1. Add-on is running inside Adobe Express (not standalone)");
      console.warn("2. code.js Document Sandbox is properly loaded");
      console.warn("3. runtime.apiProxy.extractDesignData is exposed from code.js");
      console.warn("SDK instance keys:", JSON.stringify(Object.keys(sdk)));
      console.warn("SDK runtime keys:", sdk.runtime ? JSON.stringify(Object.keys(sdk.runtime)) : "undefined");
      console.warn("SDK app keys:", sdk.app ? JSON.stringify(Object.keys(sdk.app)) : "undefined");
      
      const fallbackData = getFallbackDesignData();
      if (uploadedFileInfo) {
        fallbackData.uploadedFile = uploadedFileInfo;
        fallbackData.name = uploadedFileInfo.name;
      }
      return fallbackData;
    }
  } catch (error) {
    console.error("Fatal extraction error:", error);
    const fallbackData = getFallbackDesignData();
    if (uploadedDesignFile) {
      fallbackData.uploadedFile = {
        name: uploadedDesignFile.name,
        type: uploadedDesignFile.type,
        size: uploadedDesignFile.size,
      };
      fallbackData.name = uploadedDesignFile.name;
    }
    return fallbackData;
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
      bg: "bg-green-100",
      text: "text-green-700",
      label: "Excellent",
    },
    good: { bg: "bg-blue-100", text: "text-blue-700", label: "Good" },
    needs_work: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      label: "Needs Work",
    },
    poor: { bg: "bg-primary/10", text: "text-primary", label: "Critical" },
  };
  const style = badgeStyles[scoreLabel] || badgeStyles.needs_work;
  scoreBadge.className = `text-[9px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full ${style.bg} ${style.text}`;
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
            ? "text-green-600"
            : score >= 60
            ? "text-amber-600"
            : "text-primary"
          : "text-neutral-black/40";

      return `
      <div class="text-center">
        <div class="editorial-title text-2xl ${color}">${
        typeof score === "number" ? Math.round(score) : score
      }</div>
        <div class="text-[8px] uppercase tracking-[0.15em] text-neutral-black/30">${labels[i]}</div>
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
          ? "bg-primary"
          : risk.value > 30
          ? "bg-amber-500"
          : "bg-green-500";
      barEl.className = `risk-bar h-full ${color} rounded-full`;

      const textColor =
        risk.value > 60
          ? "text-primary"
          : risk.value > 30
          ? "text-amber-600"
          : "text-green-600";
      valueEl.className = `text-[10px] font-bold uppercase tracking-[0.1em] ${textColor}`;
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
              `<span class="inline-block bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] uppercase tracking-[0.1em] mr-1 mt-2">✓ ${p}</span>`
          )
          .join("");
        textEl.innerHTML += `<div class="mt-3">${positivesHtml}</div>`;
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
      <div class="card p-6 text-center">
        <span class="material-symbols-outlined text-4xl text-green-500 mb-3 block">check_circle</span>
        <p class="text-green-700 font-bold uppercase tracking-[0.1em] text-sm">All checks passed!</p>
        <p class="text-neutral-black/40 text-xs mt-2">Your design follows brand guidelines</p>
      </div>
    `;
    return;
  }

  violations.forEach((violation, index) => {
    const isCritical =
      violation.severity === "critical" || violation.severity === "high";
    const borderColor = isCritical
      ? "border-l-primary"
      : "border-l-amber-500";
    const iconBg = isCritical
      ? "bg-primary/10 text-primary"
      : "bg-amber-100 text-amber-600";
    const badgeColor = isCritical
      ? "bg-primary/10 text-primary"
      : "bg-amber-100 text-amber-700";
    const badgeText = isCritical ? "CRITICAL" : "WARNING";

    const card = document.createElement("div");
    card.className = `card p-4 border-l-4 ${borderColor}`;
    card.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 ${iconBg} rounded-full flex items-center justify-center">
            <span class="material-symbols-outlined text-base">warning</span>
          </div>
          <span class="font-medium text-sm text-neutral-black">${formatViolationType(
            violation.type
          )}</span>
        </div>
        <span class="text-[8px] ${badgeColor} px-2 py-1 rounded-full font-bold uppercase tracking-[0.1em]">${badgeText}</span>
      </div>
      <p class="text-xs text-neutral-black/50 mb-3 font-light leading-relaxed">${violation.description}</p>
      <div class="flex items-center justify-between">
        <span class="text-[9px] uppercase tracking-[0.1em] text-neutral-black/30">${formatAffectedElement(
          violation.affectedElement
        )}</span>
        ${
          violation.autoFixable
            ? `
          <button data-index="${index}" class="autofix-btn text-[9px] bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-bold uppercase tracking-[0.1em] hover:bg-primary hover:text-white transition-all duration-500 flex items-center gap-2">
            <span class="material-symbols-outlined text-sm">auto_fix_high</span>
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
    '<span class="material-symbols-outlined text-sm loading-spinner">progress_activity</span>';
  btn.disabled = true;

  try {
    await applyAutoFix();
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">check</span> Fixed';
    btn.classList.add("bg-green-100", "text-green-700");
    btn.classList.remove("bg-primary/10", "text-primary");
  } catch (error) {
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span> Failed';
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
  const loginSection = document.getElementById("loginSection");
  const uploadSection = document.getElementById("uploadSection");
  const resultsSection = document.getElementById("resultsSection");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const reAnalyzeBtn = document.getElementById("reAnalyzeBtn");
  const autoFixAllBtn = document.getElementById("autoFixAllBtn");
  const brandKitSelect = document.getElementById("brandKitSelect");
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const backendStatus = document.getElementById("backendStatus");
  const signoutBtn = document.getElementById("signoutBtn");
  const profileBtn = document.getElementById("profileBtn");
  const loginBtn = document.getElementById("loginBtn");
  const loginEmail = document.getElementById("loginEmail");
  const loginName = document.getElementById("loginName");
  const loginOrg = document.getElementById("loginOrg");
  const loginError = document.getElementById("loginError");

  // Check for existing session
  const storedUser = getStoredUser();
  if (storedUser) {
    currentUser = storedUser;
    showUploadSection();
  } else {
    showLoginSection();
  }

  // Login handler
  loginBtn.addEventListener("click", async () => {
    const email = loginEmail.value.trim();
    const name = loginName.value.trim();
    const org = loginOrg.value.trim();

    // Validation
    if (!email || !name) {
      loginError.textContent = "Please enter your email and name";
      loginError.classList.remove("hidden");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      loginError.textContent = "Please enter a valid email address";
      loginError.classList.remove("hidden");
      return;
    }

    loginError.classList.add("hidden");
    loginBtn.disabled = true;
    loginBtn.innerHTML =
      '<span class="material-symbols-outlined loading-spinner text-base">progress_activity</span> Signing in...';

    try {
      const user = await loginUser(email, name, org);
      storeUser(user);
      showUploadSection();
    } catch (error) {
      loginError.textContent = "Login failed. Please try again.";
      loginError.classList.remove("hidden");
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML =
        '<span class="material-symbols-outlined">login</span> Sign In';
    }
  });

  // Allow Enter key to submit login
  [loginEmail, loginName, loginOrg].forEach((input) => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        loginBtn.click();
      }
    });
  });

  // Google Sign-In handler
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  googleSignInBtn.addEventListener("click", async () => {
    googleSignInBtn.disabled = true;
    googleSignInBtn.innerHTML =
      '<span class="material-symbols-outlined loading-spinner text-base">progress_activity</span> Connecting...';
    
    try {
      await handleGoogleSignIn();
    } catch (error) {
      loginError.textContent = "Google Sign-In failed. Please try again.";
      loginError.classList.remove("hidden");
    } finally {
      googleSignInBtn.disabled = false;
      googleSignInBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      `;
    }
  });

  // Signout handler
  signoutBtn.addEventListener("click", handleSignout);

  // Profile dropdown elements
  const profileDropdown = document.getElementById("profileDropdown");
  const profileSignoutBtn = document.getElementById("profileSignoutBtn");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const profileOrg = document.getElementById("profileOrg");
  const profileOrgName = document.getElementById("profileOrgName");

  // Profile button click - toggle dropdown
  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentUser) {
      // Update profile info
      profileName.textContent = currentUser.name || "User";
      profileEmail.textContent = currentUser.email || "";
      if (currentUser.organization) {
        profileOrg.classList.remove("hidden");
        profileOrgName.textContent = currentUser.organization;
      } else {
        profileOrg.classList.add("hidden");
      }
      // Toggle dropdown
      profileDropdown.classList.toggle("hidden");
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
      profileDropdown.classList.add("hidden");
    }
  });

  // Profile signout button
  profileSignoutBtn.addEventListener("click", () => {
    profileDropdown.classList.add("hidden");
    handleSignout();
  });

  // Check backend health
  fetch(`${API_BASE_URL}/health`)
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        backendStatus.innerHTML = '<span class="material-symbols-outlined text-sm">check_circle</span>';
        backendStatus.className =
          "w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-600";
        if (currentUser) {
          loadBrandKits();
        }
      }
    })
    .catch(() => {
      backendStatus.textContent = "Offline";
      backendStatus.className =
        "text-[9px] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-primary/10 text-primary";
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
    // Reset uploaded file
    uploadedDesignFile = null;
    fileInput.value = "";
    document.getElementById("uploadedFilePreview")?.classList.add("hidden");
    dropZone.classList.remove("hidden");
  });

  // Auto-fix all
  autoFixAllBtn?.addEventListener("click", async () => {
    autoFixAllBtn.disabled = true;
    autoFixAllBtn.innerHTML =
      '<span class="material-symbols-outlined loading-spinner text-base">progress_activity</span> Fixing...';

    try {
      await applyAutoFix();
      autoFixAllBtn.innerHTML = '<span class="material-symbols-outlined text-base">check_circle</span> All Fixed';
      autoFixAllBtn.classList.remove("bg-primary");
      autoFixAllBtn.classList.add("bg-green-600");
    } catch (error) {
      autoFixAllBtn.innerHTML = "Fix Failed";
    }
  });

  // Drag and drop - upload file only, don't auto-analyze

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

  // Visual feedback for drag
  dropZone.addEventListener("dragenter", () => {
    dropZone.classList.add("border-primary", "bg-primary/5");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-primary", "bg-primary/5");
  });
  dropZone.addEventListener("drop", () => {
    dropZone.classList.remove("border-primary", "bg-primary/5");
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  // Handle file upload - just store and preview, don't analyze
  function handleFileUpload(file) {
    uploadedDesignFile = file;
    
    // Show file preview
    const preview = document.getElementById("uploadedFilePreview");
    const fileName = document.getElementById("uploadedFileName");
    const fileSize = document.getElementById("uploadedFileSize");
    
    if (preview && fileName && fileSize) {
      fileName.textContent = file.name;
      fileSize.textContent = formatFileSize(file.size);
      preview.classList.remove("hidden");
      dropZone.classList.add("hidden");
    }
    
    console.log("Design file uploaded:", file.name, file.type);
  }

  // Format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Remove file button
  const removeFileBtn = document.getElementById("removeFileBtn");
  removeFileBtn?.addEventListener("click", () => {
    uploadedDesignFile = null;
    fileInput.value = "";
    document.getElementById("uploadedFilePreview")?.classList.add("hidden");
    dropZone.classList.remove("hidden");
  });

  async function runFullAnalysis() {
    analyzeBtn.innerHTML =
      '<span class="material-symbols-outlined loading-spinner">progress_activity</span> Analyzing...';
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
        '<span class="material-symbols-outlined">bolt</span> Analyze Design';
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
    // Keep profile button visible
    document.getElementById("profileBtn").classList.remove("hidden");
    document.getElementById("profileBtn").classList.add("flex");

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
