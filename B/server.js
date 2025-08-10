// server.js - Express server for PowerBI RAG Chatbot

import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET','POST','OPTIONS'],
  credentials: true
}));

// Handle preflight globally - FIXED: More specific preflight handling
app.options('/api/*', cors());

app.use(express.json({ limit: '10mb' })); // Added limit for safety
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize AI with error handling
let ai;
try {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY // Explicitly pass API key
  });
} catch (error) {
  console.error('Failed to initialize Google GenAI:', error);
  process.exit(1);
}

const conversationHistory = new Map(); // Store conversations by sessionId

async function transformQuery(question, history) {
    const tempHistory = [...history, {
        role: 'user',
        parts: [{ text: question }]
    }];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp", // Updated to more stable model
            contents: tempHistory,
            config: {
                systemInstruction: `You are a query rewriting expert. Based on the provided chat history, 
                rephrase the "Follow Up user Question" into a complete, standalone question that can be 
                understood without the chat history. Only output the rewritten question and nothing else.`,
                temperature: 0.3, // Lower temperature for consistency
                maxOutputTokens: 200 // Limit output for query transformation
            },
        });
        return response.text?.trim() || question;
    } catch (error) {
        console.error('Error in transformQuery:', error);
        return question; // Return original question if transformation fails
    }
}

async function processQuery(question, sessionId) {
    try {
        // Validate inputs
        if (!question || typeof question !== 'string') {
            throw new Error('Invalid question provided');
        }
        
        if (!sessionId || typeof sessionId !== 'string') {
            sessionId = 'default';
        }

        // Get or create conversation history for this session
        if (!conversationHistory.has(sessionId)) {
            conversationHistory.set(sessionId, []);
        }
        const history = conversationHistory.get(sessionId);

        // Step 1: Transform the query based on conversation history
        const transformedQuery = await transformQuery(question, history);

        // Step 2: Convert the query into embedding with error handling
        let embeddings;
        try {
            embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: process.env.GEMINI_API_KEY,
                model: 'text-embedding-004',
            });
        } catch (error) {
            console.error('Failed to initialize embeddings:', error);
            throw new Error('Embedding service unavailable');
        }

        const queryVector = await embeddings.embedQuery(transformedQuery);

        // Step 3: Connect with Pinecone and search with error handling
        let pinecone, pineconeIndex;
        try {
            pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY
            });
            pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
        } catch (error) {
            console.error('Failed to initialize Pinecone:', error);
            throw new Error('Vector database unavailable');
        }

        const searchResults = await pineconeIndex.query({
            topK: 10,
            vector: queryVector,
            includeMetadata: true,
        });

        // Step 4: Extract context from search results
        const context = searchResults.matches
            ?.map(match => match.metadata?.text || '')
            .filter(text => text.length > 0)
            .join("\n\n---\n\n") || '';

        if (!context) {
            return {
                success: true,
                response: "I could not find relevant information in the provided document.",
                transformedQuery: transformedQuery
            };
        }

        // Step 5: Add user question to history
        history.push({
            role: 'user',
            parts: [{ text: transformedQuery }]
        });

        // Step 6: Generate response using the LLM
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp", // Updated to more stable model
            contents: history,
            config: {
                systemInstruction: `You are a Microsoft Power BI Expert.
                You will be given a context of relevant information and a user question.
                Your task is to answer the user's question based ONLY on the provided context with full detail available in that.
                If the answer is not in the context, you must say "I could not find the answer in the provided document."
                Keep your answers clear, concise, and educational.
                Format your response with proper markdown for better readability.
            
                Context: ${context}
                `,
                temperature: 0.7,
                maxOutputTokens: 2048
            },
        });

        // Step 7: Add AI response to history
        history.push({
            role: 'model',
            parts: [{ text: response.text }]
        });

        // Limit history to prevent memory issues (keep last 10 exchanges)
        if (history.length > 20) {
            conversationHistory.set(sessionId, history.slice(-20));
        } else {
            conversationHistory.set(sessionId, history);
        }

        return {
            success: true,
            response: response.text,
            transformedQuery: transformedQuery
        };

    } catch (error) {
        console.error('Error processing query:', error);
        return {
            success: false,
            error: error.message || 'An error occurred while processing your question.'
        };
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Routes - FIXED: More explicit route definitions
app.post('/api/chat', async (req, res) => {
    try {
        const { question, sessionId = 'default' } = req.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Question is required and must be a non-empty string'
            });
        }

        const result = await processQuery(question.trim(), sessionId);
        res.json(result);

    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Clear conversation history for a session
app.post('/api/clear-history', (req, res) => {
    try {
        const { sessionId = 'default' } = req.body;
        conversationHistory.delete(sessionId);
        res.json({ success: true, message: 'History cleared successfully' });
    } catch (error) {
        console.error('Error clearing history:', error);
        res.status(500).json({ success: false, error: 'Failed to clear history' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'PowerBI RAG Server is running',
        timestamp: new Date().toISOString()
    });
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 PowerBI RAG Server running on port ${PORT}`);
    console.log(`📖 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
