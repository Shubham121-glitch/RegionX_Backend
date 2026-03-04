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
  clearHistory
};