import Anthropic from "@anthropic-ai/sdk";

export interface ApiConfig {
  apiKey: string;
  maxRetries?: number;
}

export class ApiClient {
  private client: Anthropic;
  private maxRetries: number;

  constructor(config: ApiConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Call Claude for Simulator role with structured output using tool calling
   */
  async callSimulatorWithTool<T>(
    systemPrompt: string,
    userMessage: string,
    toolName: string,
    toolDescription: string,
    toolSchema: any,
  ): Promise<T> {
    const response = await this.client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: toolSchema,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    });

    // Extract tool use from response
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error('Response content:', JSON.stringify(response.content, null, 2));
      throw new Error("No tool use in response");
    }

    const result = toolUse.input as T;
    
    // Validate result has expected structure
    if (result && typeof result === 'object') {
      console.log(`✓ Tool ${toolName} returned valid object`);
    } else {
      console.error('Unexpected tool result:', result);
      throw new Error(`Tool ${toolName} returned invalid result`);
    }

    return result;
  }

  /**
   * Stream Claude tool call, yielding partial JSON as it arrives
   */
  async *streamSimulatorWithTool<T>(
    systemPrompt: string,
    userMessage: string,
    toolName: string,
    toolDescription: string,
    toolSchema: any,
  ): AsyncGenerator<{ partial: string; done: boolean; result?: T }> {
    const stream = this.client.messages.stream({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: toolSchema,
        },
      ],
      tool_choice: { type: "tool", name: toolName },
    });

    let jsonAccumulator = '';
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as any;
        if (delta.type === 'input_json_delta' && delta.partial_json) {
          jsonAccumulator += delta.partial_json;
          yield { partial: jsonAccumulator, done: false };
        }
      }
    }

    // Get final result
    const finalMessage = await stream.finalMessage();
    const toolUse = finalMessage.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool use in response");
    }

    yield { partial: jsonAccumulator, done: true, result: toolUse.input as T };
  }

  /**
   * Call Claude for Agent role (individual agent perspective)
   */
  async callAgent(systemPrompt: string, userMessage: string): Promise<string> {
    return this.callClaude(systemPrompt, userMessage, "claude-haiku-4-5");
  }

  /**
   * Make parallel agent calls for efficiency
   */
  async callAgentsParallel(
    calls: Array<{ systemPrompt: string; userMessage: string }>,
  ): Promise<string[]> {
    const promises = calls.map(({ systemPrompt, userMessage }) =>
      this.callAgent(systemPrompt, userMessage),
    );
    return Promise.all(promises);
  }

  /**
   * Core API call with retry logic
   */
  private async callClaude(
    systemPrompt: string,
    userMessage: string,
    model: string,
    retryCount = 0,
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      });

      // Extract text from response
      const textContent = response.content.find(
        (block) => block.type === "text",
      );
      if (!textContent || textContent.type !== "text") {
        throw new Error("No text content in API response");
      }

      return textContent.text;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.error(
          `API call failed, retrying (${retryCount + 1}/${this.maxRetries})...`,
        );
        await this.sleep(1000 * Math.pow(2, retryCount)); // Exponential backoff
        return this.callClaude(
          systemPrompt,
          userMessage,
          model,
          retryCount + 1,
        );
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
