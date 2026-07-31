import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './ChatAssistant.css';

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hello! I am your AI Policy Assistant for Maharashtra GRs.\n\n**Quick Overview:**\n• Search across 98,980+ Government Resolutions\n• Get short, simple, and direct bullet points\n• Click links below to view full GR documents',
      matchingGRs: []
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedGRModal, setSelectedGRModal] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputValue;
    if (!textToSend.trim() || loading) return;

    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputValue('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/assistant/chat', { query: textToSend });
      if (response.data.success) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: response.data.answer,
            matchingGRs: response.data.matchingGRs || []
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'assistant',
            text: 'I encountered an issue querying the GR database. Please try again.',
            matchingGRs: []
          }
        ]);
      }
    } catch (error) {
      console.error('Chat Assistant error:', error);
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Unable to connect to the GR AI search engine. Please ensure the backend server is running.',
          matchingGRs: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGR = async (grId) => {
    if (!grId) return;
    try {
      const res = await axios.get(`http://localhost:5000/api/gr/${encodeURIComponent(grId)}`);
      if (res.data.gr) {
        setSelectedGRModal(res.data.gr);
      } else {
        alert(`GR document ${grId} could not be retrieved.`);
      }
    } catch (err) {
      alert(`Error loading GR ${grId}: ` + err.message);
    }
  };

  const suggestions = [
    'Was a GR launched for Lumpy Skin Disease?',
    'Solar pump subsidy scheme rules',
    'Primary school teacher recruitment',
    'Finance Department sanction limits'
  ];

  const formatTextWithBold = (rawText) => {
    const parts = rawText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const renderMessageContent = (text, matchingGRs = []) => {
    const lines = text.split('\n');

    return (
      <div className="chat-content-body">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          // Check if bullet item
          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('* ');
          if (isBullet) {
            // Strip bullet character
            const cleanContent = trimmed.replace(/^[•\-*]\s*/, '');
            return (
              <div key={idx} className="chat-bullet-item">
                <span className="chat-bullet-dot">•</span>
                <span className="chat-bullet-text">{formatTextWithBold(cleanContent)}</span>
              </div>
            );
          }

          // Check if section header or italic note
          const isItalicNote = trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**');

          return (
            <p key={idx} className={`chat-line-p ${isItalicNote ? 'chat-italic-note' : ''}`}>
              {formatTextWithBold(line)}
            </p>
          );
        })}

        {/* Clickable GR link badges */}
        {matchingGRs && matchingGRs.length > 0 && (
          <div className="chat-gr-links-section">
            <div className="chat-gr-links-header">
              📄 Official Document Link{matchingGRs.length > 1 ? 's' : ''} (Click to View Full Text):
            </div>
            <div className="chat-gr-links-list">
              {matchingGRs.slice(0, 3).map((gr, i) => (
                <button
                  key={i}
                  className="chat-gr-link-btn"
                  onClick={() => handleOpenGR(gr.id)}
                  title={`View full GR document for ${gr.id}`}
                >
                  <span className="gr-btn-label">
                    🔗 <strong>GR {gr.id}</strong> — {gr.department}
                  </span>
                  <span className="gr-btn-action">
                    View Full GR →
                  </span>
                </button>
              ))}
            </div>
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
            <div className="chat-btn-icon">🤖</div>
            <div className="chat-btn-text">
              <span className="title">AI Policy Assistant</span>
              <span className="status"><span className="online-dot"></span>98k GR Database</span>
            </div>
          </button>
        ) : null}
      </div>

      {/* Expanded Chat Window */}
      {isOpen && (
        <div className="chat-window-container">
          <div className="chat-window-header">
            <div className="header-left">
              <div className="assistant-avatar">🏛️</div>
              <div>
                <h4>MahaGR AI Assistant</h4>
                <p><span className="online-dot"></span>98,980 Maharashtra GRs Knowledge Base</p>
              </div>
            </div>
            <div className="header-actions">
              <button onClick={() => setIsOpen(false)} title="Close Chat">✕</button>
            </div>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="suggestions-bar">
            {suggestions.map((sugg, idx) => (
              <button 
                key={idx} 
                className="chip"
                onClick={() => handleSend(sugg)}
              >
                {sugg}
              </button>
            ))}
          </div>

          {/* Chat Messages Log */}
          <div className="chat-messages-log">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message-row ${msg.sender}`}>
                <div className="message-avatar">
                  {msg.sender === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className="message-bubble">
                  {renderMessageContent(msg.text, msg.matchingGRs)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-message-row assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble loading-bubble">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>Searching 98,000+ GR database...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="chat-input-container">
            <input
              type="text"
              placeholder="Ask about any GR topic (e.g. lumpy skin, solar pumps...)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || loading}
            >
              ➔
            </button>
          </div>
        </div>
      )}

      {/* Full GR Resolution Modal */}
      {selectedGRModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedGRModal(null)}>
          <div className="modal-content" style={{
            background: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#0f172a',
              color: 'white'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>
                🔗 GR Document: {selectedGRModal.metadata?.grNumber || selectedGRModal.id}
              </h3>
              <button 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'white' }} 
                onClick={() => setSelectedGRModal(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '30px',
                fontFamily: 'Georgia, serif',
                lineHeight: '1.6',
                color: '#1e293b',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                <div style={{ textAlign: 'center', borderBottom: '2px double #475569', paddingBottom: '15px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '8px' }}>
                    <img src="/emblem_india_maharashtra.png" style={{ height: '50px' }} alt="State Emblem" />
                    <img src="/maharashtra_rajmudra_seal.png" style={{ height: '50px' }} alt="Rajmudra Seal" />
                  </div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: '4px 0', color: '#0f172a' }}>Government of Maharashtra</h2>
                  <h3 style={{ fontSize: '15px', fontWeight: '500', margin: '2px 0', color: '#334155' }}>{selectedGRModal.department || 'Department of Administration'}</h3>
                  <h4 style={{ fontSize: '13px', fontWeight: 'normal', margin: '2px 0', color: '#64748b' }}>Mantralaya, Mumbai - 400032</h4>
                </div>

                <table style={{ width: '100%', marginBottom: '20px', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '130px', padding: '4px 0' }}>Resolution No:</td>
                      <td style={{ padding: '4px 0' }}><strong>{selectedGRModal.metadata?.grNumber || selectedGRModal.id}</strong></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Date:</td>
                      <td style={{ padding: '4px 0' }}>{selectedGRModal.metadata?.date || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Subject:</td>
                      <td style={{ padding: '4px 0' }}><strong>{selectedGRModal.metadata?.subject}</strong></td>
                    </tr>
                  </tbody>
                </table>

                {selectedGRModal.sections?.introduction && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>Preamble</h5>
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0, textAlign: 'justify' }}>{selectedGRModal.sections.introduction}</p>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>Government Resolution</h5>
                  {selectedGRModal.sections?.resolutions && selectedGRModal.sections.resolutions.length > 0 ? (
                    selectedGRModal.sections.resolutions.map((clause, idx) => (
                      <p key={idx} style={{ fontSize: '13.5px', textIndent: '30px', margin: '0 0 10px 0', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                        {clause.index}. {clause.text}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0 }}>{selectedGRModal.sections?.resolution || 'The Government hereby accords formal approval.'}</p>
                  )}
                </div>

                {selectedGRModal.sections?.financials && selectedGRModal.sections.financials.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>Financial Details</h5>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Description</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px' }}>Account Head</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGRModal.sections.financials.map((fin, idx) => (
                          <tr key={idx}>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>{fin.description || 'Budget allocation'}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}><code>{fin.accountHead || 'N/A'}</code></td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>₹{fin.amount || fin.amountNumeric}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f1f5f9' }}>
              <button 
                onClick={() => window.open(`http://localhost:5000/api/gr/${selectedGRModal.id}/export/html`, '_blank')}
                style={{ backgroundColor: '#1e3a8a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🖨️ Open Full PDF View
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
