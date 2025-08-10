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
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET','POST','OPTIONS'],
  credentials: true
}));

// handle preflight globally
app.options('*', cors());

app.use(express.json());

const ai = new GoogleGenAI({});
const conversationHistory = new Map(); // Store conversations by sessionId

async function transformQuery(question, history) {
    const tempHistory = [...history, {
        role: 'user',
        parts: [{ text: question }]
    }];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: tempHistory,
            config: {
                systemInstruction: `You are a query rewriting expert. Based on the provided chat history, 
                rephrase the "Follow Up user Question" into a complete, standalone question that can be 
                understood without the chat history. Only output the rewritten question and nothing else.`,
            },
        });
        return response.text;
    } catch (error) {
        console.error('Error in transformQuery:', error);
        return question; // Return original question if transformation fails
    }
}

async function processQuery(question, sessionId) {
    try {
        // Get or create conversation history for this session
        if (!conversationHistory.has(sessionId)) {
            conversationHistory.set(sessionId, []);
        }
        const history = conversationHistory.get(sessionId);

        // Step 1: Transform the query based on conversation history
        const transformedQuery = await transformQuery(question, history);

        // Step 2: Convert the query into embedding
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: 'text-embedding-004',
        });
        const queryVector = await embeddings.embedQuery(transformedQuery);

        // Step 3: Connect with Pinecone and search
        const pinecone = new Pinecone();
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

        const searchResults = await pineconeIndex.query({
            topK: 10,
            vector: queryVector,
            includeMetadata: true,
        });

        // Step 4: Extract context from search results
        const context = searchResults.matches
            .map(match => match.metadata.text)
            .join("\n\n---\n\n");

        // Step 5: Add user question to history
        history.push({
            role: 'user',
            parts: [{ text: transformedQuery }]
        });

        // Step 6: Generate response using the LLM
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
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
            },
        });

        // Step 7: Add AI response to history
        history.push({
            role: 'model',
            parts: [{ text: response.text }]
        });

        // Update conversation history
        conversationHistory.set(sessionId, history);

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

// Routes
app.post('/api/chat', async (req, res) => {
    try {
        const { question, sessionId = 'default' } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: 'Question is required'
            });
        }

        const result = await processQuery(question, sessionId);
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
        res.status(500).json({ success: false, error: 'Failed to clear history' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'PowerBI RAG Server is running' });
});

app.listen(PORT, () => {
    console.log(`🚀 PowerBI RAG Server running on port ${PORT}`);
    console.log(`📖 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
