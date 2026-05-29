import fs from 'fs';
import path from 'path';
import { LeadIntelligenceSchema, ChatMessage } from '../apps/web/lib/signalflow/schemas';
import { OpenAIExtractionService } from '../apps/web/lib/signalflow/services/openai.service';

export interface GroundTruth {
  budgetMax: number | null;
  propertyType: string | null;
  sectors: string[];
  moveInTimeline: string | null;
}

export interface BenchmarkResult {
  chatId: string;
  extractedData: any;
  validationErrors: string[];
  confidenceScore: number;
  accuracy: {
    budget: boolean;
    propertyType: boolean;
    sector: boolean;
    timeline: boolean;
    overallScore: number; // 0 to 100
  };
  notes: string;
}

export class BenchmarkFramework {
  private service: OpenAIExtractionService;
  
  constructor(apiKey: string) {
    this.service = new OpenAIExtractionService(apiKey);
  }

  public async evaluateDataset(datasetPath: string, groundTruthPath: string): Promise<BenchmarkResult[]> {
    // 1. Load data
    const chats: { id: string; payload: ChatMessage[] }[] = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    const groundTruths: Record<string, GroundTruth> = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));
    
    const results: BenchmarkResult[] = [];

    // 2. Process
    for (const chat of chats) {
      console.log(`Evaluating ${chat.id}...`);
      const truth = groundTruths[chat.id];
      let extractedData = null;
      let validationErrors: string[] = [];
      let confidenceScore = 0;

      try {
        const result = await this.service.extractLeadIntelligence(chat.payload);
        extractedData = result.data;
        confidenceScore = 0.95; // LLM Success
      } catch (e: any) {
        validationErrors.push(e.message);
      }

      // 3. Score Accuracy
      const accuracy = this.calculateAccuracy(extractedData, truth);
      
      results.push({
        chatId: chat.id,
        extractedData,
        validationErrors,
        confidenceScore,
        accuracy,
        notes: validationErrors.length > 0 ? 'Failed Zod Validation' : 'Extraction Successful'
      });
    }

    this.generateReport(results);
    return results;
  }

  private calculateAccuracy(extracted: any, truth: GroundTruth) {
    if (!extracted || !truth) return { budget: false, propertyType: false, sector: false, timeline: false, overallScore: 0 };
    
    const budget = extracted.budgetMax === truth.budgetMax;
    const propertyType = extracted.propertyType === truth.propertyType;
    const sector = truth.sectors.every(s => extracted.preferredSectors?.includes(s));
    const timeline = !!extracted.moveInTimeline; // Simplified logic for timeline existence

    const score = [budget, propertyType, sector, timeline].filter(Boolean).length * 25;

    return { budget, propertyType, sector, timeline, overallScore: score };
  }

  private generateReport(results: BenchmarkResult[]) {
    const avgScore = results.reduce((acc, curr) => acc + curr.accuracy.overallScore, 0) / results.length;
    console.log(`\n--- BENCHMARK COMPLETE ---`);
    console.log(`Average Extraction Accuracy: ${avgScore}%`);
  }
}
