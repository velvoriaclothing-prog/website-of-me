class OpenAIProvider {
  constructor() {
    this.name = "OpenAI";
    this.enabled = Boolean(process.env.OPENAI_API_KEY);
  }

  async generate(task) {
    if (!this.enabled) throw new Error("OpenAI unavailable");
    return {
      provider: this.name,
      text: `[OpenAI] ${task.prompt}`
    };
  }
}

class GeminiProvider {
  constructor() {
    this.name = "Gemini";
    this.enabled = Boolean(process.env.GEMINI_API_KEY);
  }

  async generate(task) {
    if (!this.enabled) throw new Error("Gemini unavailable");
    return {
      provider: this.name,
      text: `[Gemini] ${task.prompt}`
    };
  }
}

class HuggingFaceProvider {
  constructor() {
    this.name = "HuggingFace";
    this.enabled = Boolean(process.env.HUGGINGFACE_API_KEY);
  }

  async generate(task) {
    if (!this.enabled) throw new Error("HuggingFace unavailable");
    return {
      provider: this.name,
      text: `[HuggingFace] ${task.prompt}`
    };
  }
}

module.exports = {
  providers: [new OpenAIProvider(), new GeminiProvider(), new HuggingFaceProvider()]
};
