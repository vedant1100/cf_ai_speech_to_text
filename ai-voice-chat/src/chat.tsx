/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";

export const ChatPage: FC = () => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AI Voice Chat</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, sans-serif;
            background: #0f0f0f;
            color: #e8e8e8;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          #app {
            width: 100%;
            max-width: 640px;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            gap: 1rem;
          }
          h1 {
            font-size: 1.25rem;
            font-weight: 600;
            text-align: center;
            color: #a0a0a0;
          }
          #messages {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.5rem 0;
          }
          .message {
            max-width: 80%;
            padding: 0.6rem 0.9rem;
            border-radius: 1rem;
            line-height: 1.5;
            font-size: 0.95rem;
          }
          .message.user {
            align-self: flex-end;
            background: #2563eb;
            color: #fff;
            border-bottom-right-radius: 0.2rem;
          }
          .message.assistant {
            align-self: flex-start;
            background: #1e1e1e;
            border: 1px solid #333;
            border-bottom-left-radius: 0.2rem;
          }
          #controls {
            display: flex;
            gap: 0.5rem;
            align-items: center;
          }
          #text-input {
            flex: 1;
            padding: 0.65rem 1rem;
            border-radius: 2rem;
            border: 1px solid #333;
            background: #1a1a1a;
            color: #e8e8e8;
            font-size: 0.95rem;
            outline: none;
          }
          #text-input:focus { border-color: #2563eb; }
          button {
            padding: 0.65rem 1.2rem;
            border-radius: 2rem;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: opacity 0.15s;
          }
          button:disabled { opacity: 0.4; cursor: not-allowed; }
          #send-btn { background: #2563eb; color: #fff; }
          #mic-btn {
            background: #1e1e1e;
            color: #e8e8e8;
            border: 1px solid #333;
            font-size: 1.2rem;
            padding: 0.6rem 0.85rem;
          }
          #mic-btn.recording { background: #dc2626; border-color: #dc2626; }
          #clear-btn {
            background: transparent;
            color: #666;
            border: 1px solid #333;
            font-size: 0.8rem;
            padding: 0.4rem 0.8rem;
          }
          #status { font-size: 0.8rem; color: #666; text-align: center; min-height: 1.2em; }
        `}</style>
      </head>
      <body>
        <div id="app">
          <h1>AI Voice Chat</h1>
          <div id="messages"></div>
          <div id="status"></div>
          <div id="controls">
            <button id="mic-btn" title="Hold to record">🎤</button>
            <input id="text-input" type="text" placeholder="Or type a message…" />
            <button id="send-btn">Send</button>
            <button id="clear-btn">Clear</button>
          </div>
        </div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  const messagesEl = document.getElementById('messages');
  const textInput   = document.getElementById('text-input');
  const sendBtn     = document.getElementById('send-btn');
  const micBtn      = document.getElementById('mic-btn');
  const clearBtn    = document.getElementById('clear-btn');
  const statusEl    = document.getElementById('status');

  // Generate a stable session ID for this browser tab
  const sessionId = sessionStorage.getItem('sid') || crypto.randomUUID();
  sessionStorage.setItem('sid', sessionId);

  function setStatus(msg) { statusEl.textContent = msg; }

  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    appendMessage('user', text);
    setStatus('Thinking…');
    sendBtn.disabled = true;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { reply } = await res.json();
      appendMessage('assistant', reply);
      setStatus('');
      // Speak the reply if TTS is available
      if ('speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(reply);
        speechSynthesis.speak(utt);
      }
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', () => {
    sendMessage(textInput.value);
    textInput.value = '';
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textInput.value);
      textInput.value = '';
    }
  });

  clearBtn.addEventListener('click', async () => {
    await fetch('/api/chat', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
    messagesEl.innerHTML = '';
    setStatus('Conversation cleared.');
    setTimeout(() => setStatus(''), 2000);
  });

  // Web Speech API — voice input
  let recognition = null;
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => {
      micBtn.classList.remove('recording');
      setStatus('');
    };
    recognition.onerror = (e) => {
      micBtn.classList.remove('recording');
      setStatus('Mic error: ' + e.error);
    };

    micBtn.addEventListener('click', () => {
      if (micBtn.classList.contains('recording')) {
        recognition.stop();
      } else {
        recognition.start();
        micBtn.classList.add('recording');
        setStatus('Listening…');
      }
    });
  } else {
    micBtn.disabled = true;
    micBtn.title = 'Speech recognition not supported in this browser';
  }
})();
            `,
          }}
        />
      </body>
    </html>
  );
};
