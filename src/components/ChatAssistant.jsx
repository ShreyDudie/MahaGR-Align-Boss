import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Building2, Scroll, Globe, Clipboard, Hand, HelpCircle, Book, Bot, Search, Lightbulb, AlertTriangle, Timer, RefreshCw, Wrench, X, User, Clock, ArrowRight, Circle, Printer, Scale, DollarSign, Upload, File, Paperclip } from 'lucide-react';
import './ChatAssistant.css';

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: '**Welcome to MahaGR AI Assistant!**\n\nI am your expert guide to **98,980+ Maharashtra Government Resolutions** and general government information.\n\n**What I can help you with:**\n• **Find GRs** - Search policies, schemes, and sanctions\n• **Government Info** - Departments, structure, and services\n• **Website Guidance** - Official portals and downloads\n• **Scheme Details** - Eligibility, benefits, and applications\n\n**Try asking:**\n• "Find farmer loan scheme GRs"\n• "What is the structure of Maharashtra government?"\n• "How to download forms from maharashtra.gov.in?"\n• "Tell me about the Agriculture Department"',
      matchingGRs: [],
      source: 'welcome'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedGRModal, setSelectedGRModal] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || loading) return;

    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputValue('');
    setLoading(true);
    setShowSuggestions(false);

    try {
      const response = await axios.post('http://localhost:5000/api/assistant/chat', { 
        query: textToSend 
      }, {
        timeout: 35000 // Increased timeout
      });
      
      const payload = response.data || {};
      const answerText = payload.answer || payload.message || 'No response received. Please try again.';
      const matchingGRs = Array.isArray(payload.matchingGRs)
        ? payload.matchingGRs
        : Array.isArray(payload.results)
          ? payload.results
          : [];
      
      if (payload.success || payload.answer || payload.message) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: answerText,
            matchingGRs,
            source: payload.source || 'gr_database'
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: 'I encountered an issue processing your query. Please try rephrasing or ask about specific GR topics.',
            matchingGRs: [],
            source: 'error'
          }
        ]);
      }
    } catch (error) {
      console.error('Chat Assistant error:', error);
      let errorMessage = 'Unable to connect to the GR AI search engine. Please ensure the backend server is running.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'The request timed out. Please try a more specific query or check your connection.';
      } else if (error.response?.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.response?.status === 503) {
        errorMessage = 'The AI assistant is currently initializing. Please wait a moment and try again.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      }
      
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: errorMessage,
          matchingGRs: [],
          source: 'error'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGR = async (grId) => {
    if (!grId) return;
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/gr/${encodeURIComponent(grId)}`);
      if (res.data.gr) {
        setSelectedGRModal(res.data.gr);
      } else {
        alert(`GR document ${grId} could not be retrieved.`);
      }
    } catch (err) {
      alert(`Error loading GR ${grId}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Enhanced suggestions with categories
  const suggestionCategories = [
    {
      label: 'GR Queries',
      suggestions: [
        'Find GRs about farmer loan schemes',
        'Solar pump subsidy scheme rules',
        'Primary school teacher recruitment',
        'Finance Department sanction limits',
        'Lumpy Skin Disease control GR'
      ]
    },
    {
      label: 'Government Info',
      suggestions: [
        'What is the structure of Maharashtra government?',
        'Tell me about the Agriculture Department',
        'Who is the Chief Minister of Maharashtra?',
        'How many districts in Maharashtra?',
        'What is the official language?'
      ]
    },
    {
      label: 'Website Help',
      suggestions: [
        'How to download forms from maharashtra.gov.in?',
        'What is MahaOnline portal?',
        'How to check scholarship status online?',
        'MSRTC bus booking website',
        'How to apply for certificates online?'
      ]
    }
  ];

  const formatText = (rawText) => {
    if (!rawText) return null;
    
    // Handle bold text
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Helper to get source display name
  const getSourceDisplay = (source) => {
    const sourceMap = {
      'welcome': 'Welcome',
      'help': 'Help',
      'general_knowledge': 'General Knowledge',
      'gr_database': 'GR Database',
      'general_knowledge_fallback': 'General Knowledge (Fallback)',
      'website': 'Website Info',
      'scholarship': 'Scholarship Info',
      'gemini': 'AI (Gemini)',
      'no_results': 'No Results',
      'fallback': 'Fallback',
      'error': 'Error',
      'greeting': 'Greeting',
      'empty_query': 'Empty Query'
    };
    return sourceMap[source] || 'AI Response';
  };

  const renderMessageContent = (text, matchingGRs = [], source = '') => {
    if (!text) return <div className="chat-empty-message">No message content</div>;
    
    const lines = text.split('\n');
    const hasGRs = matchingGRs && matchingGRs.length > 0;

    return (
      <div className="chat-content-body">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Section headers (lines with ** at start and end)
          if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
            return (
              <div key={idx} className="chat-section-header">
                {formatText(trimmed)}
              </div>
            );
          }

          // Bullet points
          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('* ');
          if (isBullet) {
            const cleanContent = trimmed.replace(/^[•\-*]\s*/, '');
            return (
              <div key={idx} className="chat-bullet-item">
                <span className="chat-bullet-dot">•</span>
                <span className="chat-bullet-text">{formatText(cleanContent)}</span>
              </div>
            );
          }

          // Italic notes
          const isItalicNote = trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**');

          return (
            <p key={idx} className={`chat-line-p ${isItalicNote ? 'chat-italic-note' : ''}`}>
              {formatText(line)}
            </p>
          );
        })}

        {/* Source badge */}
        {source && source !== 'welcome' && source !== 'greeting' && (
          <div className="chat-source-badge">
            <span className="source-dot"></span>
            {getSourceDisplay(source)}
          </div>
        )}

        {/* Clickable GR link badges */}
        {hasGRs && (
          <div className="chat-gr-links-section">
            <div className="chat-gr-links-header">
              <File size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {matchingGRs.length > 1 ? `Found ${matchingGRs.length} Related GRs` : 'Related GR Document'}
            </div>
            <div className="chat-gr-links-list">
              {matchingGRs.slice(0, 4).map((gr, i) => (
                <button
                  key={i}
                  className="chat-gr-link-btn"
                  onClick={() => handleOpenGR(gr.id)}
                  title={`View full GR document: ${gr.id}`}
                >
                  <span className="gr-btn-icon"><File size={20} strokeWidth={2} /></span>
                  <span className="gr-btn-label">
                    <strong>{gr.id}</strong>
                    <span className="gr-btn-dept">{gr.department || 'General'}</span>
                  </span>
                  <span className="gr-btn-action">View →</span>
                </button>
              ))}
            </div>
            {matchingGRs.length > 4 && (
              <div className="chat-gr-more">
                +{matchingGRs.length - 4} more GRs available
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Floating Widget Trigger Button */}
      <div className="chat-widget-trigger">
        {!isOpen ? (
          <button 
            className="chat-toggle-btn"
            onClick={() => setIsOpen(true)}
            title="Open AI Policy Search Assistant"
          >
            <div className="chat-btn-icon"><Bot size={28} strokeWidth={2} /></div>
            <div className="chat-btn-text">
              <span className="title">AI Policy Assistant</span>
              <span className="status">
                <span className="online-dot"></span>
                98k GR Database
              </span>
            </div>
            <div className="chat-btn-badge">● Live</div>
          </button>
        ) : null}
      </div>

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="chat-window-container">
          <div className="chat-window-header">
            <div className="header-left">
              <div className="assistant-avatar"><Building2 size={24} strokeWidth={2} /></div>
              <div>
                <h4>MahaGR AI Assistant</h4>
                <p>
                  <span className="online-dot"></span>
                  98,980 GRs • General Government Knowledge
                </p>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="header-btn" 
                onClick={() => {
                  setMessages([messages[0]]);
                  setShowSuggestions(true);
                  setInputValue('');
                }}
                title="Reset Chat"
              >
                ↺
              </button>
              <button 
                className="header-btn close-btn" 
                onClick={() => setIsOpen(false)} 
                title="Close Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          {showSuggestions && messages.length <= 2 && (
            <div className="suggestions-bar">
              <div className="suggestions-scroll">
                {suggestionCategories.flatMap(cat => 
                  cat.suggestions.map((sugg, idx) => (
                    <button 
                      key={`${cat.label}-${idx}`} 
                      className="chip"
                      onClick={() => handleSend(sugg)}
                    >
                      {sugg.length > 40 ? sugg.substring(0, 40) + '...' : sugg}
                    </button>
                  ))
                )}
              </div>
              <button 
                className="suggestions-toggle"
                onClick={() => setShowSuggestions(false)}
                title="Hide suggestions"
              >
                ✕
              </button>
            </div>
          )}

          {/* Chat Messages Log */}
          <div className="chat-messages-log">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message-row ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'assistant' ? <Bot size={20} strokeWidth={2} /> : <User size={20} strokeWidth={2} />}
                </div>
                <div className="message-bubble">
                  {renderMessageContent(msg.text, msg.matchingGRs, msg.source)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message-row assistant">
                <div className="message-avatar"><Bot size={20} strokeWidth={2} /></div>
                <div className="message-bubble loading-bubble">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                    Searching 98,000+ GR database...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about GRs, government, schemes, or websites..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className="chat-input-field"
              />
              <button 
                className="chat-send-btn"
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || loading}
              >
                {loading ? <Clock size={16} strokeWidth={2} /> : <ArrowRight size={16} strokeWidth={2} />}
              </button>
            </div>
            <div className="chat-input-footer">
              <span className="input-hint">Press Enter to send</span>
              <span className="input-status">
                {loading ? <><Clock size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Processing...</> : <><Circle size={8} strokeWidth={2} fill="#22c55e" color="#22c55e" style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Ready</>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Full GR Resolution Modal - Enhanced */}
      {selectedGRModal && (
        <div className="modal-overlay" onClick={() => setSelectedGRModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-left">
                <span className="modal-icon"><File size={24} strokeWidth={2} /></span>
                <h3>
                  GR Document: {selectedGRModal.metadata?.grNumber || selectedGRModal.id}
                </h3>
              </div>
              <div className="modal-header-actions">
                <button 
                  className="modal-action-btn"
                  onClick={() => window.open(`http://localhost:5000/api/gr/${selectedGRModal.id}/export/html`, '_blank')}
                  title="Open PDF View"
                >
                  <Printer size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> PDF
                </button>
                <button 
                  className="modal-close-btn"
                  onClick={() => setSelectedGRModal(null)}
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-gr-content">
                <div className="gr-header">
                  <div className="gr-emblem">
                    <Building2 size={32} strokeWidth={1.5} />
                    <Building2 size={32} strokeWidth={1.5} />
                  </div>
                  <h2>Government of Maharashtra</h2>
                  <h3>{selectedGRModal.department || 'Department of Administration'}</h3>
                  <h4>Mantralaya, Mumbai - 400032</h4>
                </div>

                <table className="gr-meta-table">
                  <tbody>
                    <tr>
                      <td className="meta-label">Resolution No:</td>
                      <td><strong>{selectedGRModal.metadata?.grNumber || selectedGRModal.id}</strong></td>
                    </tr>
                    <tr>
                      <td className="meta-label">Date:</td>
                      <td>{selectedGRModal.metadata?.date || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td className="meta-label">Subject:</td>
                      <td><strong>{selectedGRModal.metadata?.subject || 'Government Resolution'}</strong></td>
                    </tr>
                    {selectedGRModal.metadata?.intentType && (
                      <tr>
                        <td className="meta-label">Type:</td>
                        <td>{selectedGRModal.metadata.intentType}</td>
                      </tr>
                    )}
                    {selectedGRModal.districts && selectedGRModal.districts.length > 0 && (
                      <tr>
                        <td className="meta-label">Districts:</td>
                        <td>{selectedGRModal.districts.join(', ')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {selectedGRModal.sections?.preamble_english && (
                  <div className="gr-section">
                    <h5><Scroll size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Preamble</h5>
                    <p>{selectedGRModal.sections.preamble_english}</p>
                  </div>
                )}

                {selectedGRModal.sections?.introduction && (
                  <div className="gr-section">
                    <h5><Clipboard size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Introduction</h5>
                    <p>{selectedGRModal.sections.introduction}</p>
                  </div>
                )}

                <div className="gr-section">
                  <h5><Scale size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Government Resolution</h5>
                  {selectedGRModal.sections?.resolutions && selectedGRModal.sections.resolutions.length > 0 ? (
                    selectedGRModal.sections.resolutions.map((clause, idx) => (
                      <p key={idx} className="gr-clause">
                        <span className="clause-number">{clause.index}.</span>
                        {clause.text}
                      </p>
                    ))
                  ) : (
                    <p>{selectedGRModal.sections?.resolution || 'The Government hereby accords formal approval.'}</p>
                  )}
                </div>

                {selectedGRModal.sections?.financials && selectedGRModal.sections.financials.length > 0 && (
                  <div className="gr-section">
                    <h5><DollarSign size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Financial Details</h5>
                    <table className="gr-financial-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Account Head</th>
                          <th className="amount-col">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGRModal.sections.financials.map((fin, idx) => (
                          <tr key={idx}>
                            <td>{fin.description || 'Budget allocation'}</td>
                            <td><code>{fin.accountHead || 'N/A'}</code></td>
                            <td className="amount-col">
                              ₹{(fin.amount || fin.amountNumeric || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedGRModal.sections?.distribution && selectedGRModal.sections.distribution.length > 0 && (
                  <div className="gr-section">
                    <h5><Upload size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Distribution</h5>
                    <ol className="gr-distribution-list">
                      {selectedGRModal.sections.distribution.map((dist, idx) => (
                        <li key={idx}>{dist.recipient}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {selectedGRModal.sections?.footer_distribution_text && (
                  <div className="gr-section">
                    <h5><Paperclip size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Additional Distribution</h5>
                    <pre className="gr-distribution-text">{selectedGRModal.sections.footer_distribution_text}</pre>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="modal-close-footer-btn"
                onClick={() => setSelectedGRModal(null)}
              >
                Close
              </button>
              <button 
                className="modal-pdf-btn"
                onClick={() => window.open(`http://localhost:5000/api/gr/${selectedGRModal.id}/export/html`, '_blank')}
              >
                <Printer size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Open Full PDF View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}