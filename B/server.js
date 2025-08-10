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

// ====== CORS Setup ======
const allowedOrigin = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '') || 'http://localhost:5173';
console.log(`✅ Allowed CORS Origin: ${allowedOrigin}`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman or curl)
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());

// ====== AI + Vector DB Setup ======
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
        systemInstruction: `You are a query rewriting expert. 
        Rephrase the "Follow Up user Question" into a complete, standalone question 
        that can be understood without the chat history. Output only the rewritten question.`,
      },
    });
    return response.text;
  } catch (error) {
    console.error('❌ Error in transformQuery:', error);
    return question;
  }
}

async function processQuery(question, sessionId) {
  try {
    if (!conversationHistory.has(sessionId)) {
      conversationHistory.set(sessionId, []);
    }
    const history = conversationHistory.get(sessionId);

    const transformedQuery = await transformQuery(question, history);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'text-embedding-004',
    });
    const queryVector = await embeddings.embedQuery(transformedQuery);

    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    const searchResults = await pineconeIndex.query({
      topK: 10,
      vector: queryVector,
      includeMetadata: true,
    });

    const context = searchResults.matches
      .map(match => match.metadata.text)
      .join("\n\n---\n\n");

    history.push({
      role: 'user',
      parts: [{ text: transformedQuery }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: history,
      config: {
        systemInstruction: `You are a Microsoft Power BI Expert.
        Answer based ONLY on the provided context.
        If the answer is not in the context, say "I could not find the answer in the provided document."
        
        Context: ${context}
        `,
      },
    });

    history.push({
      role: 'model',
      parts: [{ text: response.text }]
    });

    conversationHistory.set(sessionId, history);

    return {
      success: true,
      response: response.text,
      transformedQuery: transformedQuery
    };

  } catch (error) {
    console.error('❌ Error processing query:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while processing your question.'
    };
  }
}

// ====== Routes ======
app.post('/api/chat', async (req, res) => {
  try {
    const { question, sessionId = 'default' } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }
    const result = await processQuery(question, sessionId);
    res.json(result);
  } catch (error) {
    console.error('❌ Error in /api/chat:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.post('/api/clear-history', (req, res) => {
  const { sessionId = 'default' } = req.body;
  conversationHistory.delete(sessionId);
  res.json({ success: true, message: 'History cleared successfully' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PowerBI RAG Server is running' });
});

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`🚀 PowerBI RAG Server running on port ${PORT}`);
  console.log(`📖 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
