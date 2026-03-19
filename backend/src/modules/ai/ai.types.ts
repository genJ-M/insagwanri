import { AiFeature } from '../../database/entities/ai-request.entity';

export const AI_DISCLAIMER =
  '※ AI가 생성한 내용입니다. 정확하지 않을 수 있으므로 검토 후 사용하시기 바랍니다.';

// GPT-4o 토큰당 비용 (2024년 기준, USD)
export const TOKEN_COST = {
  INPUT:  0.000005,    // $5.00 / 1M tokens
  OUTPUT: 0.000015,    // $15.00 / 1M tokens
} as const;

export interface AiResult {
  id: string;
  feature: AiFeature;
  output_text: string;
  disclaimer: string;
  tokens_used: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  model_name: string;
  created_at: Date;
}

export interface OpenAiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface RateLimitInfo {
  plan: string;
  daily_limit: number;
  used_today: number;
  remaining: number;
}
