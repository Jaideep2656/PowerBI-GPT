import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, RefreshCw, MessageSquare, Sparkles, BarChart3, Database, Zap, Star } from 'lucide-react';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => 'session-' + Math.random().toString(36).substr(2, 9));
  const messagesEndRef = useRef(null);

const API_BASE_URL = import.meta.env.VITE_API_URL;


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { 
      text: input, 
      isUser: true, 
      timestamp: new Date(),
      id: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: input,
          sessionId: sessionId
        }),
      });

      const data = await response.json();

      const botMessage = {
        text: data.success ? data.response : `Error: ${data.error}`,
        isUser: false,
        timestamp: new Date(),
        id: Date.now() + 1,
        transformedQuery: data.transformedQuery
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        text: `Network error: ${error.message}`,
        isUser: false,
        timestamp: new Date(),
        id: Date.now() + 1,
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(`${API_BASE_URL}/clear-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatMessage = (text) => {
    return text.split('\n').map((line, index) => (
      <div key={index} className="mb-1">
        {line}
      </div>
    ));
  };

  const suggestedQuestions = [
    "What is DAX and how is it used in PowerBI?",
    "How do I create calculated columns?",
    "Explain PowerBI data modeling best practices",
    "What are the different types of relationships?"
  ];

  const features = [
    { icon: BarChart3, title: "Data Visualization", desc: "Expert guidance on charts and dashboards", color: "blue" },
    { icon: Database, title: "Data Modeling", desc: "Best practices for data relationships", color: "green" },
    { icon: Zap, title: "DAX Formulas", desc: "Advanced calculations and measures", color: "yellow" },
    { icon: Star, title: "Performance", desc: "Optimization tips and techniques", color: "purple" }
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2.5 rounded-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-white">PowerBI Expert</h1>
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </div>
              <p className="text-slate-400 text-sm">AI-powered assistant for Microsoft PowerBI</p>
            </div>
          </div>
          
          <button
            onClick={clearHistory}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {/* Chat Area */}
        <div className="bg-slate-800 rounded-2xl mb-6 border border-slate-700">
          <div className="h-[600px] overflow-y-auto p-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col justify-center">
                {/* Welcome Header */}
                <div className="text-center mb-12">
                  <MessageSquare className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                  <h2 className="text-4xl font-bold text-white mb-4">
                    Welcome to PowerBI Expert
                  </h2>
                  <p className="text-slate-300 text-lg max-w-3xl mx-auto">
                    Your intelligent assistant for mastering Microsoft PowerBI. Get expert help with DAX formulas, 
                    data visualization, modeling, and advanced analytics.
                  </p>
                </div>

                {/* Features Grid - Matching the reference design */}
                <div className="grid grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
                  {features.map((feature, index) => (
                    <div 
                      key={index}
                      className="bg-slate-700 bg-opacity-50 rounded-lg p-6 border border-slate-600 hover:border-blue-500 transition-all duration-300 cursor-pointer group"
                    >
                      <feature.icon className={`w-8 h-8 mb-4 transition-colors duration-300 ${
                        feature.color === 'blue' ? 'text-blue-400' :
                        feature.color === 'green' ? 'text-green-400' :
                        feature.color === 'yellow' ? 'text-yellow-400' :
                        'text-purple-400'
                      }`} />
                      <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                      <p className="text-slate-400 text-sm">{feature.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Suggested Questions */}
                <div className="text-center">
                  <p className="text-slate-400 mb-4">Try asking:</p>
                  <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
                    {suggestedQuestions.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => setInput(question)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-4 py-2 rounded-full text-sm border border-slate-600 hover:border-blue-500 transition-all duration-300"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} mb-6`}
              >
                <div className={`flex max-w-4xl ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`flex-shrink-0 ${message.isUser ? 'ml-4' : 'mr-4'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      message.isUser 
                        ? 'bg-blue-600 text-white' 
                        : message.isError 
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-700 text-slate-300 border border-slate-600'
                    }`}>
                      {message.isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                  </div>
                  
                  <div className={`px-6 py-4 rounded-2xl border ${
                    message.isUser 
                      ? 'bg-blue-600 text-white border-blue-500 rounded-tr-md' 
                      : message.isError
                        ? 'bg-red-600 bg-opacity-20 text-red-300 border-red-500 rounded-tl-md'
                        : 'bg-slate-700 text-slate-100 border-slate-600 rounded-tl-md'
                  }`}>
                    <div className="text-sm leading-relaxed">
                      {formatMessage(message.text)}
                    </div>
                    {message.transformedQuery && message.transformedQuery !== message.text && (
                      <div className="mt-3 text-xs opacity-75 italic bg-slate-600 bg-opacity-50 rounded-lg px-3 py-2 border border-slate-500">
                        <span className="text-blue-300">Interpreted as:</span> {message.transformedQuery}
                      </div>
                    )}
                    <div className="text-xs opacity-60 mt-3 flex items-center space-x-2">
                      <span>{message.timestamp.toLocaleTimeString()}</span>
                      {!message.isUser && !message.isError && (
                        <div className="flex items-center space-x-1">
                          <Sparkles className="w-3 h-3" />
                          <span>AI Generated</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start mb-6">
                <div className="flex max-w-4xl">
                  <div className="flex-shrink-0 mr-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-700 text-slate-300 flex items-center justify-center border border-slate-600">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-700 text-slate-100 rounded-2xl rounded-tl-md border border-slate-600">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about PowerBI..."
                className="w-full resize-none bg-slate-700 border border-slate-600 rounded-xl px-6 py-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-32 min-h-[60px] transition-all duration-300"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className={`px-8 py-4 rounded-xl font-medium transition-all duration-300 flex items-center space-x-2 ${
                !input.trim() || isLoading
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          
          <div className="mt-4 flex justify-between items-center text-xs text-slate-400">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Powered by AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
