
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MinusSquare } from 'lucide-react';

export default function ChatbotSheet() {
    const [messages, setMessages] = useState([
        { id: 1, text: "Hello! I'm your AI assistant. How can I help with your whiteboard project?", isBot: true },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const handleSendMessage = () => {
        if (inputValue.trim() === '') return;

        // Add user message
        const newUserMessage = { id: messages.length + 1, text: inputValue, isBot: false };
        setMessages([...messages, newUserMessage]);
        setInputValue('');

        // Simulate AI response (in a real app, you'd call an API)
        setTimeout(() => {
            const botResponse = {
                id: messages.length + 2,
                text: "Thanks for your message! I'm here to assist with your whiteboard.",
                isBot: true
            };
            setMessages(prevMessages => [...prevMessages, botResponse]);
        }, 1000);
    };

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className={`fixed bottom-0 right-4 flex flex-col bg-white border border-gray-200 rounded-t-lg transition-all duration-300 ease-in-out ${isCollapsed ? 'h-13' : 'h-9/10'}`} style={{ width: '460px' }}>
            {/* Header - stays visible even when collapsed */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center">
                    <Bot className="h-7 w-7 text-blue-500 mr-2" />
                    <h2 className="font-medium">Whiteboard AI</h2>
                </div>
                <div className="flex items-center space-x-2">
                    <X className="h-5 w-5 text-gray-500 hover:text-red-500" />
                </div>
            </div>

            {/* Content - only visible when expanded */}
            {!isCollapsed && (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar">
                        {messages.map((message, key) => (
                            <div
                                key={key}
                                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                            >
                                <div
                                    className={`max-w-xs p-2 rounded-lg text-sm ${
                                        message.isBot
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-blue-500 text-white'
                                    }`}
                                >
                                    {message.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-gray-200">
                        <div className="flex items-center bg-gray-100 rounded-lg px-3 py-1">
                          <textarea
                              className="flex-1 bg-transparent outline-none resize-none h-8 py-1 text-sm"
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              placeholder="Type your message..."
                              rows={1}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendMessage();
                                  }
                              }}
                          />
                            <button
                                type="button"
                                className="ml-2 text-blue-500 hover:text-blue-600"
                                disabled={inputValue.trim() === ''}
                                onClick={handleSendMessage}
                            >
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}