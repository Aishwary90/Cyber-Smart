import { useState, useRef, useEffect } from "react";
import { chatSendMessage } from "../api";

export function ConversationalChat({
  currentUser,
  onNewCase,
  onError
}) {
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          type: "ai",
          timestamp: new Date(),
          content: {
            text: "Hi! I'm your CyberSmart AI assistant. I specialize in helping with cybercrime and cybersecurity issues. What's on your mind today?",
            suggestions: [
              "Money was stolen from my account",
              "I think someone hacked my email",
              "I got a suspicious message",
              "Help me understand if this is a scam"
            ]
          }
        }
      ]);
    }
  }, []);

  const handleSendMessage = async (text = currentMessage.trim()) => {
    if (!text) return;

    const userMessage = {
      id: Date.now() + "-user",
      type: "user",
      timestamp: new Date(),
      content: { text }
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage("");
    setIsTyping(true);

    try {
      // Call conversational API
      const data = await chatSendMessage(
        text,
        currentUser?.id ||
          currentUser?.email ||
          currentUser?.username ||
          currentUser?.name ||
          "anonymous",
      );

      const aiMessage = {
        id: Date.now() + "-ai",
        type: "ai",
        timestamp: new Date(),
        content: data
      };

      setMessages(prev => [...prev, aiMessage]);

      // If this was classified as a new case, notify parent
      if (data.caseCreated && onNewCase) {
        onNewCase(data.caseId, text);
      }

    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = {
        id: Date.now() + "-error",
        type: "ai",
        timestamp: new Date(),
        content: {
          text: "I'm having trouble connecting right now. Please try again in a moment.",
          isError: true
        }
      };
      setMessages(prev => [...prev, errorMessage]);
      onError?.(error.message);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="conversational-chat">
      <div className="chat-messages">
        {messages.map(message => (
          <ChatMessage
            key={message.id}
            message={message}
            onSuggestionClick={handleSendMessage}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-input-wrapper">
          <textarea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your cybersecurity concern or ask a question..."
            rows={1}
            className="chat-input"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!currentMessage.trim() || isTyping}
            className="chat-send-btn"
          >
            <SendIcon />
          </button>
        </div>
        <div className="chat-disclaimer">
          <span>🛡️ CyberSmart AI - Specialized in cybercrime and cybersecurity assistance</span>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ message, onSuggestionClick }) {
  const isUser = message.type === "user";

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'ai-message'}`}>
      {!isUser && (
        <div className="message-avatar">
          <span className="avatar-icon">🛡️</span>
        </div>
      )}
      <div className="message-content">
        {!isUser && <div className="message-label">CyberSmart AI</div>}
        <div className={`message-text ${message.content.isError ? 'error-message' : ''}`}>
          {message.content.text}
        </div>

        {/* Classification info for AI responses */}
        {!isUser && message.content.classification && (
          <div className="message-classification">
            <div className="classification-badge">
              <span className="classification-type">{message.content.classification.type}</span>
              <span className="classification-confidence">{message.content.classification.confidence}%</span>
            </div>
            {message.content.classification.risk && (
              <div className={`risk-indicator ${message.content.classification.risk.toLowerCase()}`}>
                {message.content.classification.risk} Risk
              </div>
            )}
          </div>
        )}

        {/* Action buttons for AI responses */}
        {!isUser && message.content.actions && (
          <div className="message-actions">
            {message.content.actions.map((action, index) => (
              <button
                key={index}
                className="action-btn"
                onClick={() => action.onClick?.()}
              >
                <span className="action-icon">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick suggestions */}
        {!isUser && message.content.suggestions && (
          <div className="message-suggestions">
            {message.content.suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-chip"
                onClick={() => onSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="message-time">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="chat-message ai-message">
      <div className="message-avatar">
        <span className="avatar-icon">🛡️</span>
      </div>
      <div className="message-content">
        <div className="message-label">CyberSmart AI</div>
        <div className="typing-indicator">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 11L12 6L17 11M12 18V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(90 12 12)"
      />
    </svg>
  );
}
