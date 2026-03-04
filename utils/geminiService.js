/**
 * OpenRouter Service for Saaz AI Chatbot
 * Handles OpenRouter API integration, conversation context, and structured response generation
 */
const OpenAI = require('openai');

class OpenRouterService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }
    
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.apiKey,
    });
    this.model = 'openai/gpt-3.5-turbo'; // Default model using OpenRouter naming convention, can be changed
    
    // In-memory storage for conversation history (in production, use Redis or DB)
    this.conversations = new Map();
    
    // Maximum number of messages to retain per conversation
    this.maxHistory = 10;
  }

  /**
   * Get or create conversation history for a user
   */
  getConversationHistory(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }
    return this.conversations.get(userId);
  }

  /**
   * Add message to conversation history
   */
  addToHistory(userId, role, content) {
    const history = this.getConversationHistory(userId);
    
    // Add new message
    history.push({ role, parts: [{ text: content }] });
    
    // Keep only the last N messages
    if (history.length > this.maxHistory) {
      this.conversations.set(userId, history.slice(-this.maxHistory));
    }
  }

  /**
   * Generate content with conversation context
   */
  async generateContent(userId, userMessage) {
    try {
      // Add user message to history
      this.addToHistory(userId, 'user', userMessage);

      // Get current conversation history
      const history = this.getConversationHistory(userId);

      // Prepare messages for OpenAI API (combining history and current message)
      const messages = history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.parts[0].text
      }));
      messages.push({ role: 'user', content: userMessage });

      // Generate content with OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const text = response.choices[0]?.message?.content || '';

      // Add AI response to history
      this.addToHistory(userId, 'assistant', text);

      return {
        success: true,
        response: text,
        finishReason: response.choices[0]?.finish_reason || 'stop',
        usage: response.usage
      };
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      return {
        success: false,
        error: error.message,
        response: null
      };
    }
  }

  /**
   * Generate structured response for app control
   */
  async generateStructuredResponse(userId, userMessage) {
    // Define the expected JSON structure for app control
    const prompt = `You are Saaz, a helpful AI travel assistant. Analyze the user's request and respond in JSON format with either a direct response or an action command.

If the user wants to perform an action in the app, respond with:
{
  "type": "action",
  "action": "navigate|click|search|scroll|open_modal|fill_input",
  "target": "destination|selector|query|position|modal_name|field_value",
  "response": "optional explanation to user"
}

If the user wants general information or chat, respond with:
{
  "type": "response",
  "response": "your helpful response"
}

For trip planning, respond with:
{
  "type": "trip_plan",
  "location": "destination",
  "days": [
    {
      "day": 1,
      "title": "Day title",
      "activities": ["activity1", "activity2"],
      "food": ["meal1", "meal2"],
      "budget_estimate": "estimated cost"
    }
  ],
  "total_estimated_budget": "total estimated cost",
  "response": "summary message"
}

For quick actions, respond with:
{
  "type": "quick_action",
  "action": "budget_calculator|religious_places|emergency_services|ai_translator|all_day_plan",
  "params": {},
  "response": "relevant response"
}

User message: "${userMessage}"

Respond ONLY with the JSON object, no other text.`;

    try {
      // Get conversation history for context
      const history = this.getConversationHistory(userId);

      // Prepare messages for OpenAI API (using original user message for context, not the full prompt)
      const messages = history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : msg.role,
        content: msg.parts[0].text
      }));
      messages.push({ role: 'user', content: prompt });

      // Generate content with OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: "json_object" } // Force JSON response
      });

      let text = response.choices[0]?.message?.content?.trim() || '';

      // Clean up the response to extract JSON
      if (text.startsWith('```json')) {
        text = text.substring(7);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();

      try {
        const structuredResponse = JSON.parse(text);
        
        // Add to history (only the original user message, not the structured prompt)
        this.addToHistory(userId, 'user', userMessage);
        this.addToHistory(userId, 'assistant', JSON.stringify(structuredResponse));

        return {
          success: true,
          data: structuredResponse,
          usage: response.usage
        };
      } catch (parseError) {
        // If JSON parsing fails, return as regular response
        console.warn('Failed to parse structured response, returning as regular response:', parseError);
        
        // Add to history
        this.addToHistory(userId, 'user', userMessage);
        this.addToHistory(userId, 'assistant', text);

        return {
          success: true,
          data: {
            type: "response",
            response: text
          },
          usage: response.usage
        };
      }
    } catch (error) {
      console.error('OpenRouter Structured Response Error:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Get conversation statistics
   */
  getStats() {
    return {
      totalConversations: this.conversations.size,
      avgHistoryLength: Array.from(this.conversations.values())
        .reduce((sum, history) => sum + history.length, 0) / this.conversations.size || 0
    };
  }

  /**
   * Clear conversation history for a user
   */
  clearHistory(userId) {
    this.conversations.delete(userId);
  }
}

module.exports = new OpenRouterService();