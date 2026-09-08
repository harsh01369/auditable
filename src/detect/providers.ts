/**
 * Judgement providers.
 *
 * The provider is deliberately a narrow seam. Everything that makes the audit
 * trustworthy lives in verification, not here, which means a cheaper or weaker
 * model degrades the audit gracefully: it finds less, and what it invents is
 * discarded, rather than reaching a customer as a false defect.
 *
 * Claude Opus 5 is the production choice. Groq is a fast, cheap path for
 * iteration and for high-volume first passes.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  JudgementSchema,
  buildEvidence,
  buildRubric,
  parseClaims,
  type JudgementProvider,
  type JudgementRequest,
} from './judgement';
import type { ClaimedFinding } from './verify';

export class AnthropicJudgementProvider implements JudgementProvider {
  readonly name: string;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    this.client = new Anthropic(options.apiKey ? { apiKey: options.apiKey } : {});
    this.model = options.model ?? 'claude-opus-5';
    this.name = `anthropic:${this.model}`;
  }

  async judge(request: JudgementRequest): Promise<ClaimedFinding[]> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // The rubric is byte-identical across pages and runs, so it caches.
      // Page evidence goes in the user turn, after the breakpoint.
      system: [
        {
          type: 'text',
          text: buildRubric(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: buildEvidence(request) }],
      thinking: { type: 'adaptive' },
      output_config: {
        format: zodOutputFormat(JudgementSchema),
        effort: 'high',
      },
    });

    return parseClaims(response.parsed_output ?? { findings: [] });
  }
}

/**
 * Groq exposes an OpenAI-compatible chat completions endpoint. We ask for a
 * JSON object and validate the shape ourselves rather than relying on
 * per-model schema support, which varies.
 */
export class GroqJudgementProvider implements JudgementProvider {
  readonly name: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: { apiKey?: string; model?: string } = {}) {
    const key = options.apiKey ?? process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set.');
    this.apiKey = key;
    // Verify against GET /openai/v1/models before changing this: Groq's
    // catalogue turns over, and a stale default fails with a 404 at run time.
    this.model = options.model ?? process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
    this.name = `groq:${this.model}`;
  }

  async judge(request: JudgementRequest): Promise<ClaimedFinding[]> {
    const body = {
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' as const },
      messages: [
        {
          role: 'system' as const,
          content: `${buildRubric()}

Respond with a single JSON object of the form {"findings": [...]}, where each finding has the keys criterionId, selector, quotedHtml, severity, summary, reasoning and optionally suggestedFix. Return {"findings": []} if you find nothing you can substantiate.`,
        },
        { role: 'user' as const, content: buildEvidence(request) },
      ],
    };

    const response = await this.postWithRetry(body);

    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return [];

    try {
      return parseClaims(JSON.parse(content));
    } catch {
      // A provider that cannot return valid JSON contributes nothing, which is
      // the correct outcome: no claims, rather than guessed ones.
      return [];
    }
  }

  /**
   * Groq enforces a tokens-per-minute budget and answers 429 when it is
   * exceeded, telling us how long to wait. Honour that rather than hammering:
   * on the free tier, waiting is the difference between an audit that
   * completes and one that reports nothing.
   */
  private async postWithRetry(body: unknown, attempts = 4): Promise<Response> {
    let lastDetail = '';
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) return response;

      lastDetail = await response.text();
      // A 400 "failed to generate JSON" is a sampling failure, not a bad
      // request: the same prompt usually succeeds on a retry. Losing a batch to
      // it means losing part of the page, so it is worth retrying.
      const jsonSamplingFailure =
        response.status === 400 && /failed to generate json/i.test(lastDetail);
      const retryable = response.status === 429 || response.status >= 500 || jsonSamplingFailure;
      if (!retryable || attempt === attempts - 1) {
        throw new Error(`Groq request failed (${response.status}): ${lastDetail.slice(0, 300)}`);
      }

      const header = response.headers.get('retry-after');
      const waitSeconds = header
        ? Number(header)
        : Number(/try again in ([\d.]+)s/i.exec(lastDetail)?.[1] ?? 0);
      const delay = Number.isFinite(waitSeconds) && waitSeconds > 0
        ? waitSeconds * 1000 + 500
        : 2000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 65_000)));
    }
    throw new Error(`Groq request failed after ${attempts} attempts: ${lastDetail.slice(0, 300)}`);
  }
}

/** A provider that never claims anything. Used to audit deterministically only. */
export class NullJudgementProvider implements JudgementProvider {
  readonly name = 'none';
  async judge(): Promise<ClaimedFinding[]> {
    return [];
  }
}

export function providerFromEnv(): JudgementProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicJudgementProvider({ model: process.env.ANTHROPIC_MODEL });
  }
  if (process.env.GROQ_API_KEY) return new GroqJudgementProvider();
  return new NullJudgementProvider();
}
