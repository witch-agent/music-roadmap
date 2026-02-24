// Vercel API Route for Music Roadmap Generator
// MiniMax M2.5 API

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.ANTHROPIC_API_KEY;
const MINIMAX_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.minimax.io/anthropic';

export default async function handler(req, res) {
    console.log('Request received:', { method: req.method, url: req.url });
    console.log('Environment check:', { 
        hasMinimaxKey: !!process.env.MINIMAX_API_KEY, 
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        nodeEnv: process.env.NODE_ENV 
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { prompt } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        if (!MINIMAX_API_KEY) {
            console.error('API key not found. Available env vars:', Object.keys(process.env).filter(k => k.includes('API')));
            return res.status(500).json({ 
                error: 'API key not configured',
                message: 'لطفاً در Vercel متغیر ANTHROPIC_API_KEY یا MINIMAX_API_KEY را تنظیم کنید'
            });
        }
        
        // Extract system prompt and user prompt
        const systemPrompt = prompt.split('USER INPUTS:')[0].trim();
        const userPrompt = 'USER INPUTS:' + prompt.split('USER INPUTS:')[1];
        
        console.log('Calling MiniMax API with prompt length:', prompt.length);
        
        const response = await fetch(`${MINIMAX_BASE_URL}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': MINIMAX_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'MiniMax-M2.5',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: userPrompt
                            }
                        ]
                    }
                ]
            })
        });
        console.log('MiniMax API response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('MiniMax API error:', errorData);
            return res.status(response.status).json({ 
                error: 'API request failed',
                details: errorData
            });
        }
        
        const data = await response.json();
        console.log('MiniMax API response:', JSON.stringify(data).substring(0, 500));
        
        // Handle different response formats
        let result = '';
        
        // Try Anthropic-style response with thinking
        if (data.content && Array.isArray(data.content)) {
            for (const block of data.content) {
                if (block.type === 'text') {
                    result += block.text;
                }
            }
        }
        
        // If no text found, try OpenAI-style
        if (!result && data.choices && data.choices[0]) {
            result = data.choices[0].message?.content || data.choices[0].text || '';
        }
        
        // Fallback to raw response
        if (!result) {
            result = JSON.stringify(data);
        }
        
        console.log('Returning response to frontend, length:', result.length);
        return res.status(200).json({ response: result });
        
    } catch (error) {
        console.error('Server error:', error.name, error.message, error.stack);
        
        if (error.name === 'AbortError') {
            return res.status(504).json({ 
                error: 'Request timeout',
                message: 'The request took too long. Please try again.'
            });
        }
        
        // Check if it's a network error (like failed to fetch)
        if (error.message && error.message.includes('fetch')) {
            return res.status(502).json({ 
                error: 'Bad gateway',
                message: 'Cannot connect to MiniMax API. Please check your API key and try again.'
            });
        }
        
        return res.status(500).json({ 
            error: error.message,
            type: error.name
        });
    }
}
