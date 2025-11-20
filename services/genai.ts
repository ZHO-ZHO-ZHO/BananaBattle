import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates an image based on the specific model capabilities.
 * Supports text-to-image and image-to-image (for Flash models).
 */
export const generateImage = async (
  modelLabel: string, 
  prompt: string,
  referenceImages: string[] = []
): Promise<string> => {
  
  // Map user-friendly labels to actual SDK model IDs
  // Note: 'gemini-2.5-flash-image-preview' -> 'gemini-2.5-flash-image'
  // Note: 'gemini-3-pro-image-preview' -> 'imagen-3.0-generate-001' (Best approx for high quality generation)
  
  if (modelLabel.includes('flash-image')) {
    // Flash Image supports Image-to-Image / Editing
    return generateContentImage('gemini-2.5-flash-image', prompt, referenceImages);
  } 
  else {
    // Pro / Imagen usually strictly Text-to-Image in standard generateImages API
    // We map the requested "gemini-3-pro" to Imagen 3
    return generateDedicatedImage('imagen-3.0-generate-001', prompt);
  }
};

const generateContentImage = async (model: string, prompt: string, images: string[]): Promise<string> => {
  try {
    const parts: any[] = [];

    // Add reference images if available
    if (images && images.length > 0) {
      images.forEach(base64Data => {
        // Extract MimeType from Data URL (e.g., "data:image/png;base64,..." -> "image/png")
        const mimeMatch = base64Data.match(/^data:(.*);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

        // Remove data URL prefix for the API call
        const base64Clean = base64Data.split(',')[1]; 
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Clean
          }
        });
      });
    }

    // Add the text prompt
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: parts,
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates returned");
    }

    const contentParts = candidates[0].content?.parts;
    if (!contentParts) {
      throw new Error("No content parts returned");
    }

    for (const part of contentParts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Flash Image Generation Error:", error);
    throw new Error(error.message || "Failed to generate image with Flash model");
  }
};

const generateDedicatedImage = async (model: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: model,
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1', 
        outputMimeType: 'image/jpeg'
      },
    });

    const generatedImages = response.generatedImages;
    if (!generatedImages || generatedImages.length === 0) {
      throw new Error("No images returned from generation");
    }

    const imageBytes = generatedImages[0].image?.imageBytes;
    if (!imageBytes) {
      throw new Error("Image bytes are missing");
    }

    return `data:image/jpeg;base64,${imageBytes}`;
  } catch (error: any) {
    console.error("Imagen Generation Error:", error);
    throw new Error(error.message || "Failed to generate image with Pro/Imagen model");
  }
};