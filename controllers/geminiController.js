const openRouterService = require('../utils/geminiService');

const chatHandler = async (req, res) => {
  try {
    console.log('Received chat request:', { message: req.body.message?.substring(0, 50), userId: req.body.userId });
    const { message, userId, sessionId } = req.body;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log('Validation failed: Missing or invalid message');
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a non-empty string'
      });
    }

    if (!userId || typeof userId !== 'string') {
      console.log('Validation failed: Missing or invalid userId');
      return res.status(400).json({
        success: false,
        error: 'userId is required and must be a string'
      });
    }

    // Sanitize inputs
    const sanitizedMessage = message.trim().substring(0, 2000); // Limit message length
    const sanitizedUserId = userId.substring(0, 100); // Limit user ID length

    console.log('Processing with sanitized inputs:', { userId: sanitizedUserId, messageLength: sanitizedMessage.length });

    // Generate structured response
    const result = await openRouterService.generateStructuredResponse(sanitizedUserId, sanitizedMessage);

    if (!result.success) {
      console.error('Gemini service error:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate response',
        response: null
      });
    }

    console.log('Successfully generated response:', { type: result.data?.type, responseLength: result.data?.response?.length });
    res.json({
      success: true,
      data: result.data,
      usage: result.usage
    });
  } catch (error) {
    console.error('Chat controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      response: null
    });
  }
};

const healthCheck = async (req, res) => {
  try {
    const stats = openRouterService.getStats();
    
    res.json({
      success: true,
      message: 'Saaz AI Chatbot service is running',
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        apiConnected: !!process.env.OPENROUTER_API_KEY,
        rateLimitEnabled: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

const autofillRegionHandler = async (req, res) => {
  try {
    const { regionName } = req.body;

    if (!regionName || typeof regionName !== 'string' || regionName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'regionName is required'
      });
    }

    const prompt = `You are a travel expert. Generate comprehensive information for a travel region named "${regionName.trim()}". 
    Respond ONLY with a JSON object in the following format:
    {
      "shortDescription": "A 1-2 sentence catchy description",
      "detailedDescription": "A detailed 2-3 paragraph description",
      "history": "Historical background of the region",
      "culturalValues": "Cultural values and significance",
      "traditions": "Local traditions and customs",
      "placesToVisit": [
        { "name": "Place Name 1", "description": "Short description of place 1" },
        { "name": "Place Name 2", "description": "Short description of place 2" },
        { "name": "Place Name 3", "description": "Short description of place 3" }
      ]
    }`;

    // We use generateContent or a direct call. Let's use the service's openai directly for a clean prompt if needed, 
    // or just use generateContent with a system-like message.
    // Actually, openRouterService.openai is public.
    
    const response = await openRouterService.openai.chat.completions.create({
      model: openRouterService.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    let text = response.choices[0]?.message?.content?.trim() || '';
    const data = JSON.parse(text);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Autofill controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate region data'
    });
  }
};

const clearHistory = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required to clear history'
      });
    }

    openRouterService.clearHistory(userId);

    res.json({
      success: true,
      message: 'Conversation history cleared successfully'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear history'
    });
  }
};

module.exports = {
  chatHandler,
  healthCheck,
  clearHistory,
  autofillRegionHandler
};