/**
 * =============================================================================
 * Epsilon - Document Sandbox
 * =============================================================================
 *
 * This script runs in Adobe Express's Document Sandbox and has access to the
 * real canvas/document data via express-document-sdk.
 *
 * It exposes an API to the panel (index.js) to extract design elements:
 * - Colors used in the design
 * - Fonts used in text elements
 * - Text content
 * - Image/media dimensions
 */

import { editor } from "express-document-sdk";
import addOnSandboxSdk from "add-on-sdk-document-sandbox";

const { runtime } = addOnSandboxSdk.instance;

/**
 * Convert fill color to hex string
 */
function colorToHex(color) {
  if (!color) return null;

  // Handle different color types
  if (color.colorValue) {
    const cv = color.colorValue;
    const r = Math.round(cv.red * 255);
    const g = Math.round(cv.green * 255);
    const b = Math.round(cv.blue * 255);
    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
  }

  // If it's a solid color fill object
  if (color.type === "solid" && color.color) {
    return colorToHex(color.color);
  }

  return null;
}

/**
 * Extract colors from a node's fill
 */
function extractFillColors(node, colors) {
  try {
    if (node.fill) {
      const fill = node.fill;

      // Solid color fill
      if (fill.type === "solid" || fill.colorValue) {
        const hex = colorToHex(fill);
        if (hex && !colors.includes(hex)) {
          colors.push(hex);
        }
      }

      // Color fill with color property
      if (fill.color) {
        const hex = colorToHex(fill.color);
        if (hex && !colors.includes(hex)) {
          colors.push(hex);
        }
      }
    }

    // Check stroke color
    if (node.stroke && node.stroke.color) {
      const hex = colorToHex(node.stroke.color);
      if (hex && !colors.includes(hex)) {
        colors.push(hex);
      }
    }
  } catch (e) {
    // Some nodes may not have fill/stroke properties
  }
}

/**
 * Extract text data from a TextNode
 */
function extractTextData(node, textContent, fonts) {
  try {
    if (
      node.type === "Text" ||
      node.type === "StandaloneText" ||
      node.type === "ThreadedText"
    ) {
      // Get text content
      const text = node.text || node.fullContent || "";
      if (text && text.trim()) {
        const textInfo = {
          text: text.trim(),
          font: "Unknown",
          fontSize: 16,
          color: "#000000",
        };

        // Try to extract font info
        try {
          if (node.characterStyles) {
            for (const style of node.characterStyles) {
              if (style.fontFamily) {
                textInfo.font = style.fontFamily;
                if (!fonts.includes(style.fontFamily)) {
                  fonts.push(style.fontFamily);
                }
              }
              if (style.fontSize) {
                textInfo.fontSize = style.fontSize;
              }
              if (style.color) {
                const hex = colorToHex(style.color);
                if (hex) {
                  textInfo.color = hex;
                }
              }
              break; // Just get first style for simplicity
            }
          }
        } catch (styleError) {
          // Character styles may not be accessible
        }

        textContent.push(textInfo);
      }
    }
  } catch (e) {
    // Text extraction failed for this node
  }
}

/**
 * Extract image/media data and classify type
 * Types: logo, photo, graphic, icon, background
 */
function extractImageData(node, images) {
  try {
    // Check for media containers or image nodes
    if (
      node.type === "MediaContainer" ||
      node.type === "Image" ||
      node.type === "ImageRectangle"
    ) {
      const bounds = node.boundsLocal || {};
      const width = bounds.width || 100;
      const height = bounds.height || 100;
      const aspectRatio = width / height;
      const area = width * height;

      // Classify image type based on size and aspect ratio
      let imageType = "photo"; // Default to photo (won't affect brand colors)

      // Small square-ish images are likely logos/icons
      if (area < 40000 && aspectRatio > 0.5 && aspectRatio < 2) {
        imageType = "logo";
      }
      // Very small images are icons
      else if (area < 10000) {
        imageType = "icon";
      }
      // Very large images covering most of canvas are backgrounds
      else if (area > 500000) {
        imageType = "background";
      }
      // Medium sized images are likely decorative photos
      else {
        imageType = "photo"; // Photos - colors should be IGNORED
      }

      images.push({
        type: imageType,
        width: width,
        height: height,
        isDecorativePhoto: imageType === "photo" || imageType === "background",
      });
    }

    // Check for rectangles with image fills
    if (node.type === "Rectangle" && node.fill && node.fill.type === "image") {
      const bounds = node.boundsLocal || {};
      images.push({
        type: "photo", // Image fills are usually decorative photos
        width: bounds.width || 100,
        height: bounds.height || 100,
        isDecorativePhoto: true,
      });
    }
  } catch (e) {
    // Image extraction failed
  }
}

/**
 * Traverse all nodes and extract design data
 */
function traverseNodes(node, data) {
  try {
    // Extract from current node
    extractFillColors(node, data.colorsUsed);
    extractTextData(node, data.textContent, data.fontsUsed);
    extractImageData(node, data.images);

    // Traverse children if available
    if (node.allChildren) {
      for (const child of node.allChildren) {
        traverseNodes(child, data);
      }
    } else if (node.children) {
      for (const child of node.children) {
        traverseNodes(child, data);
      }
    }
  } catch (e) {
    // Node traversal error
  }
}

/**
 * Main function to extract all design data from the current document
 */
function extractDesignData() {
  const data = {
    canvasId: `express_canvas_${Date.now()}`,
    name: "Adobe Express Design",
    colorsUsed: [],
    fontsUsed: [],
    textContent: [],
    images: [],
    layout: "unknown",
    backgroundColor: "#FFFFFF",
  };

  try {
    // Get the document root
    const documentRoot = editor.documentRoot;
    if (!documentRoot) {
      console.log("No document root available");
      return data;
    }

    // Get all pages
    const pages = documentRoot.pages;
    if (!pages) {
      console.log("No pages found");
      return data;
    }

    // Traverse each page
    for (const page of pages) {
      // Get artboards on this page
      if (page.allChildren) {
        for (const artboard of page.allChildren) {
          // Extract background color from artboard if available
          if (artboard.fill) {
            const bgHex = colorToHex(artboard.fill);
            if (bgHex) {
              data.backgroundColor = bgHex;
            }
          }

          // Traverse all elements in the artboard
          traverseNodes(artboard, data);
        }
      }
    }

    console.log("Extracted design data:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error extracting design data:", error);
  }

  // Ensure we have at least some default data
  if (data.colorsUsed.length === 0) {
    data.colorsUsed = ["#FFFFFF", "#000000"];
  }

  return data;
}

/**
 * Expose the API to the panel
 */
runtime.exposeApi({
  extractDesignData: () => {
    console.log("BrandGuard: extractDesignData() called from panel");
    try {
      const data = extractDesignData();
      console.log("BrandGuard: Returning design data with", data.colorsUsed.length, "colors,", data.fontsUsed.length, "fonts");
      return data;
    } catch (error) {
      console.error("BrandGuard: Error in extractDesignData:", error);
      throw error;
    }
  },
});

console.log("Epsilon Document Sandbox initialized");
console.log("BrandGuard: API exposed - extractDesignData() is ready");
