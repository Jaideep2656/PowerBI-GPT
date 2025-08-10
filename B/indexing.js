// indexing.js - Document indexing script for PowerBI RAG

import * as dotenv from 'dotenv';
dotenv.config();
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

async function indexDocument() {
    try {
        console.log('🚀 Starting document indexing process...');

        // Step 1: Load the PDF file
        const PDF_PATH = './powerbi.pdf';
        console.log(`📄 Loading PDF from: ${PDF_PATH}`);
        
        const pdfLoader = new PDFLoader(PDF_PATH);
        const rawDocs = await pdfLoader.load();
        console.log(`✅ PDF loaded successfully. Pages: ${rawDocs.length}`);

        // Step 2: Create chunks of the PDF
        console.log('🔪 Splitting document into chunks...');
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const chunkedDocs = await textSplitter.splitDocuments(rawDocs);
        console.log(`✅ Document split into ${chunkedDocs.length} chunks`);

        // Step 3: Initialize the Embedding model
        console.log('🧠 Initializing embedding model...');
        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GEMINI_API_KEY,
            model: "models/text-embedding-004",
        });
        console.log('✅ Embedding model initialized');

        // Step 4: Initialize Pinecone Client
        console.log('🌲 Connecting to Pinecone...');
        const pinecone = new Pinecone();
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
        console.log(`✅ Connected to Pinecone index: ${process.env.PINECONE_INDEX_NAME}`);

        // Step 5: Embed Chunks and Upload to Pinecone
        console.log('⬆️ Uploading embeddings to Pinecone...');
        await PineconeStore.fromDocuments(chunkedDocs, embeddings, {
            pineconeIndex,
            maxConcurrency: 5,
        });
        console.log('✅ All chunks embedded and uploaded to Pinecone successfully!');

        console.log('🎉 Document indexing completed successfully!');
        
    } catch (error) {
        console.error('❌ Error during indexing:', error);
        process.exit(1);
    }
}

// Check if required environment variables are set
function checkEnvironmentVariables() {
    const requiredVars = ['GEMINI_API_KEY', 'PINECONE_INDEX_NAME'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars.join(', '));
        console.error('Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
}

// Run the indexing process
async function main() {
    console.log('🔧 Checking environment variables...');
    checkEnvironmentVariables();
    console.log('✅ Environment variables validated');
    
    await indexDocument();
}

main().catch(console.error);