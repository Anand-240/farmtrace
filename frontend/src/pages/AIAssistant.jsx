import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'Namaste! Main aapka FarmTrace assistant hoon. Mujhe batao kya bechna hai — jaise "500 kilo tamatar FastVeg wale ko 22 rupaye kilo mein bechna hai"'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/api/ai/parse-transfer', { message: userMsg });
      const parsed = res.data.parsed;

      if (!parsed.understood) {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: 'Maafi chahta hoon, samajh nahi aaya. Kya aap dobara bata sakte hain? Jaise: "500 kilo tamatar ₹22 mein bechna hai"'
        }]);
        return;
      }

      if (parsed.clarificationNeeded) {
        setMessages(prev => [...prev, {
          role: 'ai',
          text: parsed.clarificationNeeded
        }]);
        return;
      }

      // Sab kuch mila — confirmation dikhao
      setPendingTransfer(parsed);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: parsed.summary,
        isConfirm: true,
        parsed
      }]);

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Kuch galat hua. Dobara try karo.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const confirmTransfer = async () => {
    if (!pendingTransfer) return;
    setLoading(true);

    try {
      const res = await api.post('/api/ai/confirm-transfer', {
        produceId: pendingTransfer.produceId,
        receiverPhone: pendingTransfer.receiverPhone,
        pricePerKg: pendingTransfer.pricePerKg,
        location: pendingTransfer.location,
        transferType: pendingTransfer.transferType
      });

      setConfirmed(true);
      setPendingTransfer(null);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `✓ ${res.data.message} Distributor ko payment request mil gayi hai!`,
        isSuccess: true
      }]);

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: 'Request bhejne mein error aaya: ' + err.message
      }]);
    } finally {
      setLoading(false);
    }
  };

  const cancelTransfer = () => {
    setPendingTransfer(null);
    setMessages(prev => [...prev, {
      role: 'ai',
      text: 'Theek hai, cancel kar diya. Kya kuch aur karna hai?'
    }]);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
          ← Dashboard
        </button>
        <div>
          <h2 style={styles.title}>AI Assistant</h2>
          <p style={styles.subtitle}>Apni fasal bechne ke liye batao</p>
        </div>
      </div>

      {/* Chat messages */}
      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            ...styles.msgRow,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            {msg.role === 'ai' && (
              <div style={styles.aiAvatar}>AI</div>
            )}
            <div style={{
              ...styles.bubble,
              background: msg.role === 'user' ? '#27500A' :
                         msg.isSuccess ? '#EAF3DE' : 'white',
              color: msg.role === 'user' ? 'white' :
                    msg.isSuccess ? '#27500A' : '#333',
              border: msg.isSuccess ? '1px solid #C0DD97' : 'none'
            }}>
              <p style={styles.bubbleText}>{msg.text}</p>

              {/* Confirmation card */}
              {msg.isConfirm && msg.parsed && pendingTransfer && (
                <div style={styles.confirmCard}>
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmLabel}>Fasal</span>
                    <span style={styles.confirmValue}>{msg.parsed.cropType}</span>
                  </div>
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmLabel}>Price</span>
                    <span style={styles.confirmValue}>₹{msg.parsed.pricePerKg}/kg</span>
                  </div>
                  <div style={styles.confirmRow}>
                    <span style={styles.confirmLabel}>Receiver</span>
                    <span style={styles.confirmValue}>{msg.parsed.receiverName}</span>
                  </div>
                  {msg.parsed.location && (
                    <div style={styles.confirmRow}>
                      <span style={styles.confirmLabel}>Location</span>
                      <span style={styles.confirmValue}>{msg.parsed.location}</span>
                    </div>
                  )}
                  <div style={styles.confirmBtns}>
                    <button onClick={confirmTransfer} style={styles.confirmBtn}
                      disabled={loading}>
                      {loading ? 'Bheji ja rahi hai...' : 'Haan, Bhejo!'}
                    </button>
                    <button onClick={cancelTransfer} style={styles.cancelBtn}>
                      Nahi, Badlo
                    </button>
                  </div>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div style={styles.userAvatar}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{...styles.msgRow, justifyContent:'flex-start'}}>
            <div style={styles.aiAvatar}>AI</div>
            <div style={{...styles.bubble, background:'white'}}>
              <p style={styles.typingDots}>● ● ●</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {!confirmed && (
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Jaise: 500 kilo tamatar FastVeg ko 22 rupaye mein bechna hai..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            disabled={loading || !!pendingTransfer}
          />
          <button
            onClick={sendMessage}
            style={styles.sendBtn}
            disabled={loading || !input.trim() || !!pendingTransfer}>
            Bhejo
          </button>
        </div>
      )}

      {confirmed && (
        <div style={styles.doneRow}>
          <button onClick={() => navigate('/dashboard')} style={styles.doneBtn}>
            Dashboard pe Wapas Jao
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight:'100vh', background:'#f0f4f0', display:'flex', flexDirection:'column' },
  header: { display:'flex', alignItems:'center', gap:'1rem', background:'white', padding:'1rem 1.5rem', borderBottom:'1px solid #eee' },
  backBtn: { background:'none', border:'none', color:'#27500A', cursor:'pointer', fontSize:'0.9rem' },
  title: { color:'#27500A', margin:0, fontSize:'1.2rem' },
  subtitle: { color:'#888', margin:0, fontSize:'0.8rem' },
  chatBox: { flex:1, padding:'1rem', overflowY:'auto', display:'flex', flexDirection:'column', gap:'1rem', maxHeight:'calc(100vh - 160px)', overflowY:'auto' },
  msgRow: { display:'flex', gap:'0.5rem', alignItems:'flex-end' },
  aiAvatar: { width:'32px', height:'32px', borderRadius:'50%', background:'#27500A', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:'bold', flexShrink:0 },
  userAvatar: { width:'32px', height:'32px', borderRadius:'50%', background:'#085041', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.85rem', fontWeight:'bold', flexShrink:0 },
  bubble: { maxWidth:'75%', padding:'0.75rem 1rem', borderRadius:'12px', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' },
  bubbleText: { margin:0, fontSize:'0.95rem', lineHeight:1.5 },
  typingDots: { margin:0, color:'#aaa', letterSpacing:'4px' },
  confirmCard: { marginTop:'0.75rem', padding:'0.75rem', background:'#f8f8f8', borderRadius:'8px', border:'1px solid #eee' },
  confirmRow: { display:'flex', justifyContent:'space-between', padding:'0.3rem 0', borderBottom:'1px solid #eee' },
  confirmLabel: { color:'#888', fontSize:'0.85rem' },
  confirmValue: { color:'#27500A', fontSize:'0.85rem', fontWeight:'bold' },
  confirmBtns: { display:'flex', gap:'0.5rem', marginTop:'0.75rem' },
  confirmBtn: { flex:1, padding:'0.6rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'0.9rem' },
  cancelBtn: { flex:1, padding:'0.6rem', background:'white', color:'#666', border:'1px solid #ddd', borderRadius:'8px', cursor:'pointer', fontSize:'0.9rem' },
  inputRow: { display:'flex', gap:'0.5rem', padding:'1rem', background:'white', borderTop:'1px solid #eee' },
  input: { flex:1, padding:'0.75rem', border:'1px solid #ddd', borderRadius:'8px', fontSize:'0.95rem' },
  sendBtn: { padding:'0.75rem 1.5rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'0.95rem' },
  doneRow: { padding:'1rem', background:'white', borderTop:'1px solid #eee' },
  doneBtn: { width:'100%', padding:'0.75rem', background:'#27500A', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontSize:'1rem' }
};
