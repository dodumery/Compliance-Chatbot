
export enum AuditStatus {
  COMPLIANT = 'COMPLIANT',
  VIOLATION = 'VIOLATION',
  UNCERTAIN = 'UNCERTAIN',
}

export interface AuditReport {
  status: AuditStatus;
  rawMarkdown: string;
  groundingUrls?: Array<{ uri: string; title: string }>;
}

export interface ImageEditRequest {
  image: string; // base64
  prompt: string;
}

export interface RegulationSource {
  id: string;
  name: string;
  type: string;
  content: string;
  visualContext?: string[]; // Array of base64 page images
  timestamp: number;
}
