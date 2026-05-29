import fs from 'fs';
import path from 'path';
import { OpenAIExtractionService } from '../apps/web/lib/signalflow/services/openai.service';
import { ChatMessage } from '../apps/web/lib/signalflow/schemas';

// Assuming all_chats.md format is already parsed into JSON locally
// For demonstration, we'll write the scaffold that would execute the runner
const DATASET_PATH = path.join(__dirname, '../artifacts/scratch/parsed_chats.json');

async function runBenchmark() {
  console.log('--- SIGNALFLOW EXTRACTION BENCHMARK RUNNER ---');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY must be set in environment to run benchmark.');
    process.exit(1);
  }

  const service = new OpenAIExtractionService();
  
  // 1. Load parsed chats
  // const chats: { id: string; payload: ChatMessage[] }[] = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const chats: any[] = []; // Stub for compilation
  
  let total = chats.length;
  let successful = 0;
  let validationFailures = 0;
  
  const results = [];

  // 2. Execute extraction sequentially to avoid immediate rate limits
  for (const chat of chats) {
    console.log(`Analyzing Chat ${chat.id}...`);
    try {
      const result = await service.extractLeadIntelligence(chat.payload);
      if (result.success) {
        successful++;
        results.push({ id: chat.id, status: 'SUCCESS', data: result.data });
      }
    } catch (e: any) {
      validationFailures++;
      results.push({ id: chat.id, status: 'FAILED', error: e.message });
      console.error(`Failed on Chat ${chat.id}: ${e.message}`);
    }
  }

  // 3. Output Report
  console.log('\n--- EXTRACTION REPORT ---');
  console.log(`Total Chats Processed: ${total}`);
  console.log(`Successful Extractions: ${successful}`);
  console.log(`Validation Failures: ${validationFailures}`);
  console.log(`Success Rate: ${total > 0 ? (successful / total) * 100 : 0}%`);
  
  fs.writeFileSync(path.join(__dirname, 'benchmark_results.json'), JSON.stringify(results, null, 2));
  console.log('Detailed results saved to benchmark_results.json');
}

runBenchmark().catch(console.error);
