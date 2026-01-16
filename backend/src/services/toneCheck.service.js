/**
 * =============================================================================
 * BrandGuard AI - Tone Check Service
 * =============================================================================
 *
 * ARCHITECTURE DECISION:
 * This service handles tone and language compliance checking including:
 * - Banned word detection
 * - Tone style matching (formal/casual/professional)
 * - Sentence length analysis
 * - Required phrase verification
 *
 * TONE ANALYSIS:
 * For full AI-powered tone analysis, this service integrates with the
 * Gemini service. For quick checks, it provides rule-based validation.
 */

import { logger } from "../utils/logger.js";
import geminiService from "./gemini.service.js";

// ---------------------------------------------------------------------------
// TONE UTILITIES
// ---------------------------------------------------------------------------

/**
 * Normalize text for comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
const normalizeText = (text) => {
  if (!text) return "";
  return text.toLowerCase().trim();
};

/**
 * Extract words from text
 * @param {string} text - Text to extract words from
 * @returns {Array} Array of words
 */
const extractWords = (text) => {
  if (!text) return [];
  return text.toLowerCase().match(/\b\w+\b/g) || [];
};

/**
 * Count sentences in text
 * @param {string} text - Text to count sentences in
 * @returns {number} Number of sentences
 */
const countSentences = (text) => {
  if (!text) return 0;
  // Simple sentence detection based on punctuation
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  return sentences.length;
};

/**
 * Get average words per sentence
 * @param {string} text - Text to analyze
 * @returns {number} Average words per sentence
 */
const getAverageWordsPerSentence = (text) => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return 0;

  const totalWords = sentences.reduce((sum, sentence) => {
    return sum + extractWords(sentence).length;
  }, 0);

  return Math.round(totalWords / sentences.length);
};

// ---------------------------------------------------------------------------
// TONE CHECKING SERVICE
// ---------------------------------------------------------------------------

/**
 * Check for banned words in text
 *
 * @param {string} text - Text to check
 * @param {Array} bannedWords - Array of banned words
 * @returns {Object} Check result with found banned words
 */
export const checkBannedWords = (text, bannedWords) => {
  if (!text || !bannedWords || bannedWords.length === 0) {
    return {
      hasBannedWords: false,
      foundWords: [],
      violations: [],
    };
  }

  const normalizedText = normalizeText(text);
  const textWords = extractWords(text);
  const foundWords = [];
  const violations = [];

  bannedWords.forEach((bannedWord) => {
    const normalizedBanned = normalizeText(bannedWord);

    // Check for exact word match or phrase match
    if (normalizedText.includes(normalizedBanned)) {
      // Find actual occurrences
      const regex = new RegExp(`\\b${normalizedBanned}\\b`, "gi");
      const matches = text.match(regex);

      if (matches) {
        foundWords.push({
          word: bannedWord,
          count: matches.length,
          matches: matches,
        });

        violations.push({
          type: "tone",
          severity: "high",
          description: `Banned word "${bannedWord}" found in text (${
            matches.length
          } occurrence${matches.length > 1 ? "s" : ""})`,
          affectedElement: bannedWord,
          suggestedFix: "Remove or replace with appropriate alternative",
          autoFixable: false,
        });
      }
    }
  });

  return {
    hasBannedWords: foundWords.length > 0,
    foundWords,
    violations,
  };
};

/**
 * Check for required phrases in text
 *
 * @param {string} text - Text to check
 * @param {Array} requiredPhrases - Array of required phrases
 * @returns {Object} Check result with missing phrases
 */
export const checkRequiredPhrases = (text, requiredPhrases) => {
  if (!requiredPhrases || requiredPhrases.length === 0) {
    return {
      allPresent: true,
      missingPhrases: [],
      violations: [],
    };
  }

  const normalizedText = normalizeText(text);
  const missingPhrases = [];
  const violations = [];

  requiredPhrases.forEach((phrase) => {
    const normalizedPhrase = normalizeText(phrase);

    if (!normalizedText.includes(normalizedPhrase)) {
      missingPhrases.push(phrase);

      violations.push({
        type: "tone",
        severity: "medium",
        description: `Required phrase "${phrase}" is missing from text`,
        affectedElement: phrase,
        suggestedFix: `Include the phrase "${phrase}" in your content`,
        autoFixable: false,
      });
    }
  });

  return {
    allPresent: missingPhrases.length === 0,
    missingPhrases,
    violations,
  };
};

/**
 * Check sentence length compliance
 *
 * @param {string} text - Text to check
 * @param {number} maxLength - Maximum allowed words per sentence
 * @returns {Object} Check result with long sentences
 */
export const checkSentenceLength = (text, maxLength) => {
  if (!text || !maxLength) {
    return {
      isCompliant: true,
      longSentences: [],
      violations: [],
      avgWordsPerSentence: 0,
    };
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const longSentences = [];
  const violations = [];

  sentences.forEach((sentence, index) => {
    const wordCount = extractWords(sentence).length;

    if (wordCount > maxLength) {
      longSentences.push({
        sentence:
          sentence.trim().substring(0, 100) +
          (sentence.length > 100 ? "..." : ""),
        wordCount,
        index,
      });

      violations.push({
        type: "tone",
        severity: "low",
        description: `Sentence ${
          index + 1
        } has ${wordCount} words (max: ${maxLength})`,
        affectedElement: sentence.trim().substring(0, 50) + "...",
        suggestedFix: "Consider breaking into shorter sentences",
        autoFixable: false,
      });
    }
  });

  return {
    isCompliant: longSentences.length === 0,
    longSentences,
    violations,
    avgWordsPerSentence: getAverageWordsPerSentence(text),
    totalSentences: sentences.length,
  };
};

/**
 * Analyze tone style (simple rule-based)
 * For advanced analysis, uses Gemini AI
 *
 * @param {string} text - Text to analyze
 * @param {string} expectedStyle - Expected tone style
 * @returns {Object} Tone analysis result
 */
export const analyzeToneStyle = (text, expectedStyle) => {
  if (!text) {
    return {
      detectedTone: "unknown",
      matchesExpected: true,
      confidence: 0,
    };
  }

  // Simple heuristics for tone detection
  const formalIndicators = [
    "please",
    "kindly",
    "sincerely",
    "regarding",
    "pursuant",
    "hereby",
  ];
  const casualIndicators = [
    "hey",
    "cool",
    "awesome",
    "gonna",
    "wanna",
    "super",
    "!",
  ];
  const friendlyIndicators = [
    "thanks",
    "appreciate",
    "happy",
    "excited",
    "love",
    "enjoy",
  ];

  const words = extractWords(text);
  const textLower = text.toLowerCase();

  let formalScore = 0;
  let casualScore = 0;
  let friendlyScore = 0;

  formalIndicators.forEach((word) => {
    if (textLower.includes(word)) formalScore++;
  });

  casualIndicators.forEach((indicator) => {
    if (textLower.includes(indicator)) casualScore++;
  });

  friendlyIndicators.forEach((word) => {
    if (textLower.includes(word)) friendlyScore++;
  });

  // Check exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 2) casualScore++;

  // Determine detected tone
  let detectedTone = "professional";
  let maxScore = formalScore;

  if (casualScore > maxScore) {
    detectedTone = "casual";
    maxScore = casualScore;
  }
  if (friendlyScore > maxScore) {
    detectedTone = "friendly";
    maxScore = friendlyScore;
  }
  if (formalScore > 0 && formalScore === maxScore) {
    detectedTone = "formal";
  }

  const matchesExpected =
    !expectedStyle ||
    expectedStyle === "any" ||
    detectedTone === expectedStyle ||
    (expectedStyle === "professional" && detectedTone === "formal");

  return {
    detectedTone,
    matchesExpected,
    expectedStyle: expectedStyle || "any",
    confidence: Math.min(100, (maxScore / 3) * 100),
    scores: {
      formal: formalScore,
      casual: casualScore,
      friendly: friendlyScore,
    },
  };
};

/**
 * Run full tone compliance check
 *
 * @param {string} text - Text to check
 * @param {Object} toneRules - Brand kit tone rules
 * @returns {Object} Full tone compliance report
 */
export const checkToneCompliance = async (text, toneRules) => {
  if (!text || !toneRules) {
    return {
      score: 100,
      violations: [],
      isCompliant: true,
      message: "No text or tone rules to check",
    };
  }

  const allViolations = [];
  let penaltyPoints = 0;

  // Check banned words
  const bannedResult = checkBannedWords(text, toneRules.bannedWords);
  if (bannedResult.hasBannedWords) {
    allViolations.push(...bannedResult.violations);
    penaltyPoints += bannedResult.foundWords.length * 15; // 15 points per banned word
  }

  // Check required phrases
  const requiredResult = checkRequiredPhrases(text, toneRules.requiredPhrases);
  if (!requiredResult.allPresent) {
    allViolations.push(...requiredResult.violations);
    penaltyPoints += requiredResult.missingPhrases.length * 10; // 10 points per missing phrase
  }

  // Check sentence length
  if (toneRules.maxSentenceLength) {
    const lengthResult = checkSentenceLength(text, toneRules.maxSentenceLength);
    if (!lengthResult.isCompliant) {
      allViolations.push(...lengthResult.violations);
      penaltyPoints += lengthResult.longSentences.length * 5; // 5 points per long sentence
    }
  }

  // Check tone style
  if (toneRules.style && toneRules.style !== "any") {
    const styleResult = analyzeToneStyle(text, toneRules.style);
    if (!styleResult.matchesExpected) {
      allViolations.push({
        type: "tone",
        severity: "medium",
        description: `Text tone appears ${styleResult.detectedTone}, expected ${toneRules.style}`,
        affectedElement: text.substring(0, 100) + "...",
        suggestedFix: `Adjust language to be more ${toneRules.style}`,
        autoFixable: false,
      });
      penaltyPoints += 20;
    }
  }

  // Calculate score
  const score = Math.max(0, 100 - penaltyPoints);

  return {
    score,
    violations: allViolations,
    isCompliant: allViolations.length === 0,
    message:
      allViolations.length === 0
        ? "Text complies with tone guidelines"
        : `${allViolations.length} tone/language issue(s) found`,
  };
};

// Export service object
export default {
  checkBannedWords,
  checkRequiredPhrases,
  checkSentenceLength,
  analyzeToneStyle,
  checkToneCompliance,
};
