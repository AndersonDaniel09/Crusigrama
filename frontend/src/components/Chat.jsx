import { useState, useRef, useEffect } from 'react';
import './Chat.css';

/** @param {{ messages: Array<{playerId,name,text,timestamp}>, myPlayerId: string, onSend: (text:string)=>void }} */
export default function Chat({ messages = [], myPlayerId, onSend }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  // Auto-scroll al nuevo mensaje
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="chat">
      <h3 className="chat-title">Chat</h3>

      <div className="chat-messages">
        {messages.map((msg, i) => {
          const isMe = msg.playerId === myPlayerId;
          const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return (
            <div key={i} className={`chat-msg ${isMe ? 'chat-msg--me' : ''}`}>
              {!isMe && <span className="chat-author">{msg.name}</span>}
              <div className="chat-bubble">
                <span className="chat-text">{msg.text}</span>
                <span className="chat-time">{time}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe un mensaje…"
          maxLength={200}
        />
        <button className="btn btn-primary chat-send" onClick={handleSend}>
          ↑
        </button>
      </div>
    </div>
  );
}
