import { GoogleGenAI, Type } from "@google/genai";
import { ProductGroup, Sale } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeBusinessLogic = async (inventory: ProductGroup[], sales: Sale[]): Promise<string> => {
  try {
    const inventorySummary = inventory.map(g => 
      g.variants.map(v => 
        `${g.brand} ${g.thickness} (${g.color}) - ${v.lengthFeet}ft - Stock: ${v.stockPieces}`
      ).join('\n')
    ).join('\n');

    const recentSales = sales.slice(0, 20).map(s => 
      `Total: ${s.finalAmount}, Discount: ${s.discount}, Due: ${s.dueAmount}`
    ).join('\n');

    const prompt = `
      You are an expert business analyst for a Tin (Corrugated Iron Sheet) shop in Bangladesh.
      
      Inventory Snapshot:
      ${inventorySummary}

      Recent Sales Snapshot:
      ${recentSales}

      Context:
      - Brands like AKS, PHP, TK are premium.
      - Colors like 'Master Green', 'Boicha' (White) are popular.
      - Sizes 6,7,8,9,10 feet are standard.
      - Shop uses 70/72 divisor logic for bundles.

      Task:
      Analyze if we are overstocked on specific Brands or Colors that aren't selling? 
      Are we giving too much discount (waiving too much money)?
      Provide a strategic summary in Bengali.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 1024 }, 
      },
    });

    return response.text || "বিশ্লেষণ করতে ব্যর্থ হয়েছে।";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "AI সেবা বর্তমানে অনুপলব্ধ।";
  }
};

export const getMarketUpdates = async (): Promise<{ text: string, sources: { title: string, uri: string }[] }> => {
  try {
    const prompt = "Current corrugated iron sheet (dheutin) price in Bangladesh today. AKS, PHP, KDS tin price list for 0.32mm, 0.42mm, color vs plain.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "তথ্যাবলী পাওয়া যায়নি।";
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((s: any) => s !== null) || [];

    return { text, sources };
  } catch (error) {
    console.error("Search Error:", error);
    return { text: "মার্কেট আপডেট পাওয়া যায়নি।", sources: [] };
  }
};