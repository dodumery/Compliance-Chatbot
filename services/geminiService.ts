
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AuditStatus, AuditReport, RegulationSource } from "../types";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async runAudit(sources: RegulationSource[], scenario: string, useSearch: boolean): Promise<AuditReport> {
    const regulationText = sources.map(s => `[SOURCE: ${s.name}]\n${s.content}`).join('\n---\n');
    
    const visualParts = sources.flatMap(s => s.visualContext || []).map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: 'image/png'
      }
    }));

    const promptText = `
      You are a high-precision Compliance Auditor. 
      Analyze the [Scenario] against the [Regulation Text] and [Visual Layout Images].
      
      [Scenario]:
      ${scenario}

      [Regulation Text]:
      ${regulationText}
      
      CRITICAL INSTRUCTIONS (SPEED & STRUCTURE):
      1. BE CONCISE: Provide your analysis within 10 seconds. Focus on the core mapping.
      2. TABLE USAGE: ALWAYS summarize the mapping between scenario and clauses in a Markdown Table for clarity.
      3. HIGHLIGHTING: Use <span class="highlight-red">text</span> for violation triggers.
      4. BREADCRUMB STYLE: When referencing clauses, follow a hierarchical path structure.
         Example: [카테고리] > [하위 항목] > [세부 조항]
         Specifically for 'Approval Authority Regulations (전결규정)', follow this style:
         '콘텐츠 > 1. 콘텐츠 계약 > 신규계약'
      
      Output Format:
      ### ⚖️ 판정 결과: [위반 / 적합 / 판단 불가]
      ### 📜 관련 근거 조항
      > (Hierarchical Path Example: 콘텐츠 > 1.콘텐츠 계약 > 신규계약)
      > (규정 원문 조항 인용)
      ### 🔍 상세 분석
      (사안-조항 매핑 테이블 포함)
      ### 💡 조치 권고 사항
      - (핵심 조치 사항)
    `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...visualParts,
          { text: promptText }
        ]
      },
      config: {
        tools: useSearch ? [{ googleSearch: {} }] : undefined,
        thinkingConfig: { thinkingBudget: 1024 }
      },
    });

    const text = response.text || "No response generated.";
    let status = AuditStatus.UNCERTAIN;
    if (text.includes('위반')) status = AuditStatus.VIOLATION;
    else if (text.includes('적합')) status = AuditStatus.COMPLIANT;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const urls = groundingChunks?.map((chunk: any) => ({
      uri: chunk.web?.uri || chunk.maps?.uri,
      title: chunk.web?.title || chunk.maps?.title || "Reference"
    })).filter((u: any) => u.uri);

    return { status, rawMarkdown: text, groundingUrls: urls };
  }

  async askQuestion(sources: RegulationSource[], question: string): Promise<string> {
    const regulationText = sources.map(s => `[SOURCE: ${s.name}]\n${s.content}`).join('\n---\n');
    const visualParts = sources.flatMap(s => s.visualContext || []).map(base64 => ({
      inlineData: {
        data: base64.split(',')[1] || base64,
        mimeType: 'image/png'
      }
    }));

    const promptText = `
      You are a helpful Regulation Expert. Explain the [Question] based strictly on the [Regulation].
      
      [Question]: ${question}
      [Regulation Text]: ${regulationText}
      
      INSTRUCTIONS (SPEED & STRUCTURE):
      - If the source has a table, RECREATE it as a Markdown Table.
      - Be direct and professional. Target <10s response time.
      - BREADCRUMB STYLE: Use hierarchical path for references (e.g., '콘텐츠 > 1.콘텐츠 계약 > 신규계약').
      
      Output Format:
      ### ℹ️ 질문 해설: [요약]
      ### 📖 상세 근거 및 테이블 해설
      (테이블 포함 상세 설명)
    `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [...visualParts, { text: promptText }]
      },
      config: { 
        thinkingConfig: { thinkingBudget: 1024 } 
      }
    });

    return response.text || "답변을 생성할 수 없습니다.";
  }

  async editImage(base64Image: string, prompt: string): Promise<string> {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/png' } },
          { text: prompt },
        ],
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
  }
}
