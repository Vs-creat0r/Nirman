/**
 * @fileoverview Provider-agnostic model adapter for Nirman Agentic Layer.
 *
 * Implements S6-4 T1 (+ smoke-hardening):
 * - ModelProvider interface with structured drafting.
 * - OpenAI-compatible HTTP adapter with timeout and graceful degradation.
 * - Stream-tolerant response parsing: handles a single JSON body OR a
 *   Server-Sent-Events (`data: {...}`) stream, and strips ```json fences /
 *   surrounding prose that some gateways (Omniroute, Gemini) emit.
 * - Injectable FakeModelProvider for deterministic testing without external API keys.
 *
 * Zero database writes, zero mutations.
 */

export interface QuotedLineItem {
  readonly itemName: string;
  readonly description?: string;
  readonly hsnSacCode?: string;
  readonly quantity: number;
  readonly unit: string;
  readonly rate: number;
  readonly projectItemId?: string;
}

export interface VendorQuoteDraft {
  readonly vendorId: string;
  readonly items: readonly QuotedLineItem[];
  readonly taxRate: number;
  readonly freight?: number;
  readonly deliveryDays?: number;
  readonly paymentTerms?: string;
  readonly notes?: string;
}

export interface DraftCostComparisonContext {
  readonly userPrompt?: string;
  readonly materialRequest: Record<string, unknown>;
  readonly candidateVendors: readonly Record<string, unknown>[];
  readonly itemRateHistory: readonly Record<string, unknown>[];
  readonly selfCorrectionFeedback?: string;
}

export interface DraftCostComparisonResult {
  readonly ok: boolean;
  readonly vendorQuotes?: readonly VendorQuoteDraft[];
  readonly reasoning?: string;
  readonly error?: string;
}

export interface ModelProvider {
  draftCostComparison(context: DraftCostComparisonContext): Promise<DraftCostComparisonResult>;
}

export interface ModelProviderConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly modelName?: string;
  readonly timeoutMs?: number;
}

/**
 * Production OpenAI-compatible chat model adapter.
 * Uses native fetch with AbortSignal timeout and graceful typed error returns.
 */
export class OpenAICompatibleModelProvider implements ModelProvider {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(config?: ModelProviderConfig) {
    this.apiKey = config?.apiKey || process.env.AGENT_MODEL_API_KEY;
    this.baseUrl = (config?.baseUrl || process.env.AGENT_MODEL_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    this.modelName = config?.modelName || process.env.AGENT_MODEL_NAME || "gpt-4o";
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  /**
   * Extract the assistant message content from either a normal JSON body
   * or a Server-Sent-Events (`data: {...}`) stream. Returns null if none found.
   */
  private extractCompletionContent(raw: string, contentType: string): string | null {
    const trimmed = raw.trimStart();
    const isSSE = contentType.includes("text/event-stream") || trimmed.startsWith("data:");

    if (isSSE) {
      let acc = "";
      for (const line of raw.split(/\r?\n/)) {
        const l = line.trim();
        if (!l.startsWith("data:")) continue;
        const payload = l.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
          };
          const choice = obj.choices?.[0];
          const piece = choice?.delta?.content ?? choice?.message?.content ?? "";
          if (piece) acc += piece;
        } catch {
          // skip keepalive / non-JSON stream lines
        }
      }
      return acc.length > 0 ? acc : null;
    }

    try {
      const obj = JSON.parse(raw) as { choices?: Array<{ message?: { content?: string } }> };
      return obj.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Parse model JSON tolerantly: strip ```json fences and any prose around
   * the first/last brace before parsing.
   */
  private parseLooseJson(content: string): Record<string, unknown> {
    let s = content.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) s = fence[1].trim();
    try {
      return JSON.parse(s) as Record<string, unknown>;
    } catch {
      const first = s.indexOf("{");
      const last = s.lastIndexOf("}");
      if (first >= 0 && last > first) {
        return JSON.parse(s.slice(first, last + 1)) as Record<string, unknown>;
      }
      throw new Error("No JSON object found in model output.");
    }
  }

  async draftCostComparison(context: DraftCostComparisonContext): Promise<DraftCostComparisonResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: "Model API key is not configured (AGENT_MODEL_API_KEY is missing).",
      };
    }

    const systemPrompt = [
      "You are the Nirman ERP Procurement Agent.",
      "Your task is to analyze an approved Material Request, candidate vendors, and historical item rate benchmarks, then generate a multi-vendor Cost Comparison quote draft.",
      "CRITICAL RULES:",
      "1. You must include at least 2 distinct vendor quotes from the provided candidate vendors.",
      "2. Only quote items that appear in the Material Request.",
      "3. Use realistic rates grounded in the historical rate benchmarks provided.",
      "4. Respond with ONLY raw JSON — no markdown, no code fences, no prose before or after.",
      "5. The JSON MUST match this exact structure:",
      "{",
      '  "reasoning": "Brief explanation of vendor selection and rate grounding",',
      '  "vendorQuotes": [',
      "    {",
      '      "vendorId": "string (valid vendor ID from candidates)",',
      '      "taxRate": 18,',
      '      "freight": 0,',
      '      "deliveryDays": 7,',
      '      "paymentTerms": "30 days net",',
      '      "items": [',
      '        { "itemName": "Cement", "quantity": 100, "unit": "bags", "rate": 350 }',
      "      ]",
      "    }",
      "  ]",
      "}",
    ].join("\n");

    const userContent = JSON.stringify({
      userInstruction: context.userPrompt || "Generate cost comparison draft from approved Material Request.",
      materialRequest: context.materialRequest,
      candidateVendors: context.candidateVendors,
      itemRateHistory: context.itemRateHistory,
      feedbackPrompt: context.selfCorrectionFeedback,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 2500,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `Model API error (${response.status}): ${errorText.slice(0, 200)}`,
        };
      }

      const rawText = await response.text();
      const content = this.extractCompletionContent(rawText, response.headers.get("content-type") || "");
      if (!content) {
        return {
          ok: false,
          error: "Model returned an empty completion response.",
        };
      }

      let parsed: { reasoning?: string; vendorQuotes?: VendorQuoteDraft[] };
      try {
        parsed = this.parseLooseJson(content) as { reasoning?: string; vendorQuotes?: VendorQuoteDraft[] };
      } catch {
        return {
          ok: false,
          error: `Model output was not valid JSON: ${content.slice(0, 200)}`,
        };
      }

      if (!Array.isArray(parsed.vendorQuotes)) {
        return {
          ok: false,
          error: "Model output JSON missing 'vendorQuotes' array.",
        };
      }

      return {
        ok: true,
        vendorQuotes: parsed.vendorQuotes,
        reasoning: parsed.reasoning || "Generated quote comparison from grounded candidates.",
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = (err as { name?: string })?.name === "AbortError";
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: isAbort ? `Model request timed out after ${this.timeoutMs}ms` : `Model request failed: ${message}`,
      };
    }
  }
}

/**
 * Deterministic test fake model provider for CI and testing without external network calls.
 */
export class FakeModelProvider implements ModelProvider {
  private callCount = 0;
  private readonly callHistory: DraftCostComparisonContext[] = [];
  private readonly handler?: (ctx: DraftCostComparisonContext, attempt: number) => Promise<DraftCostComparisonResult> | DraftCostComparisonResult;
  private readonly defaultQuotes?: readonly VendorQuoteDraft[];
  private readonly defaultError?: string;

  constructor(options?: {
    customHandler?: (ctx: DraftCostComparisonContext, attempt: number) => Promise<DraftCostComparisonResult> | DraftCostComparisonResult;
    defaultQuotes?: readonly VendorQuoteDraft[];
    defaultError?: string;
  }) {
    this.handler = options?.customHandler;
    this.defaultQuotes = options?.defaultQuotes;
    this.defaultError = options?.defaultError;
  }

  async draftCostComparison(context: DraftCostComparisonContext): Promise<DraftCostComparisonResult> {
    this.callCount++;
    this.callHistory.push(context);

    if (this.handler) {
      return await this.handler(context, this.callCount);
    }

    if (this.defaultError) {
      return {
        ok: false,
        error: this.defaultError,
      };
    }

    if (this.defaultQuotes) {
      return {
        ok: true,
        vendorQuotes: this.defaultQuotes,
        reasoning: "Generated by FakeModelProvider with configured default quotes.",
      };
    }

    // Default 2-vendor grounded mockup based on context MR
    const mrItems = (Array.isArray(context.materialRequest.items) ? context.materialRequest.items : []) as Array<Record<string, unknown>>;
    const candidateVendors = context.candidateVendors;

    if (candidateVendors.length < 2) {
      return {
        ok: false,
        error: "Insufficient candidate vendors provided in context.",
      };
    }

    const v1 = candidateVendors[0];
    const v2 = candidateVendors[1];

    const quote1Items: QuotedLineItem[] = mrItems.map((it) => ({
      itemName: String(it.itemName || "Item"),
      description: typeof it.description === "string" ? it.description : undefined,
      hsnSacCode: typeof it.hsnSacCode === "string" ? it.hsnSacCode : undefined,
      quantity: Number(it.quantity) || 1,
      unit: String(it.unit || "nos"),
      rate: 350,
      projectItemId: typeof it.projectItemId === "string" ? it.projectItemId : undefined,
    }));

    const quote2Items: QuotedLineItem[] = mrItems.map((it) => ({
      itemName: String(it.itemName || "Item"),
      description: typeof it.description === "string" ? it.description : undefined,
      hsnSacCode: typeof it.hsnSacCode === "string" ? it.hsnSacCode : undefined,
      quantity: Number(it.quantity) || 1,
      unit: String(it.unit || "nos"),
      rate: 340,
      projectItemId: typeof it.projectItemId === "string" ? it.projectItemId : undefined,
    }));

    return {
      ok: true,
      reasoning: "Default test fake generated 2 vendor quotes from context MR items.",
      vendorQuotes: [
        {
          vendorId: String(v1._id || "v_1"),
          items: quote1Items,
          taxRate: 18,
          freight: 0,
          deliveryDays: 5,
          paymentTerms: "30 days net",
          notes: "Direct factory pricing",
        },
        {
          vendorId: String(v2._id || "v_2"),
          items: quote2Items,
          taxRate: 18,
          freight: 500,
          deliveryDays: 7,
          paymentTerms: "15 days net",
          notes: "Includes local transport",
        },
      ],
    };
  }

  getCalls(): readonly DraftCostComparisonContext[] {
    return this.callHistory;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.callHistory.length = 0;
  }
}

/**
 * Returns default production model provider configured via environment.
 */
export function getDefaultModelProvider(): ModelProvider {
  return new OpenAICompatibleModelProvider();
}
