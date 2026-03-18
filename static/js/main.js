// Auto-ingest on Send + continuous chat log + expandable citations

let __ragIngested = false;

// DOM
const fileInput = document.getElementById('file');
const questionInput = document.getElementById('question');
const topkInput = document.getElementById('topk');
const modelInput = document.getElementById('model');
const askBtn = document.getElementById('askBtn');
const statusEl = document.getElementById('status');
const mainCard = document.getElementById('main-card');
const answerContainer = document.getElementById('answer-container');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    __ragIngested = false;
    const f = fileInput.files && fileInput.files[0];
    setStatus(f ? 'File selected. Ready to ingest on Send.' : 'No file ingested yet.');
  });
}

async function readResponse(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  const t = await res.text();
  return { ok: false, error: t || `HTTP ${res.status}` };
}

async function ingestFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/ingest', { method: 'POST', body: form });
  const data = await readResponse(res);
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || data.status || `Ingest failed (HTTP ${res.status})`);
  }
  return data;
}

async function askQuestion(question, topk, model) {
  const payload = { question, top_k: Number(topk), model };
  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readResponse(res);
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Ask failed (HTTP ${res.status})`);
  }
  return data;
}

function appendUserMessage(question) {
  if (answerContainer) answerContainer.classList.remove('hidden');
  if (mainCard) mainCard.classList.add('chat-mode');

  const userGroup = document.createElement('div');
  userGroup.className = 'message-group user-group';
  
  const bubble = document.createElement('div');
  bubble.className = 'question-bubble full';
  bubble.textContent = question;
  
  userGroup.appendChild(bubble);
  answerContainer.appendChild(userGroup);
  
  if(questionInput) {
    questionInput.value = '';
    questionInput.style.height = 'auto'; 
  }
  
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

function appendAIMessage(data, errorText = null) {
  const aiGroup = document.createElement('div');
  aiGroup.className = 'message-group ai-group';

  const answerBubble = document.createElement('div');
  answerBubble.className = 'answer-bubble';
  answerBubble.textContent = errorText ? errorText : (data.answer ? String(data.answer) : '');
  aiGroup.appendChild(answerBubble);

  if (!errorText && data.citations) {
     const citationsContainer = document.createElement('div');
     citationsContainer.className = 'citations-container';
     
     const toggleBtn = document.createElement('button');
     toggleBtn.className = 'citations-toggle-btn circle-btn';
     toggleBtn.style.width = 'auto';
     toggleBtn.style.borderRadius = '20px';
     toggleBtn.style.padding = '6px 14px';
     toggleBtn.innerHTML = `
        <svg fill="currentColor" viewBox="0 0 24 24" width="14" height="14" style="margin-right: 6px;">
           <path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"></path>
        </svg>
        Sources
     `;
     
     const listWrapper = document.createElement('div');
     listWrapper.className = 'citations-list hidden';
     
     let rawCits = [];
     if(typeof data.citations === 'string') {
        rawCits = data.citations.split('\n').filter(s => s.trim().length > 0);
     } else if(Array.isArray(data.citations)) {
        rawCits = data.citations;
     }

     if(rawCits.length > 0) {
       rawCits.forEach((citText, idx) => {
           let score = "";
           let text = citText;
           let num = (idx + 1).toString();
           
           let numMatch = citText.match(/^\[(\d+)\]/);
           if(numMatch) { num = numMatch[1]; }
           
           let scoreMatch = citText.match(/score=([0-9\.]+)\s*\|\s*"(.*)"/);
           if(scoreMatch) {
               score = "Score: " + parseFloat(scoreMatch[1]).toFixed(3);
               text = scoreMatch[2];
           } else {
               let pipeIndex = citText.indexOf('|');
               if(pipeIndex > 0) {
                  let maybeScore = citText.substring(0, pipeIndex);
                  let sMatch = maybeScore.match(/score=([0-9\.]+)/);
                  if(sMatch) score = "Score: " + parseFloat(sMatch[1]).toFixed(3);
                  text = citText.substring(pipeIndex + 1).replace(/^"/,'').replace(/"$/,'').trim();
               }
           }
           
           const citeItem = document.createElement('div');
           citeItem.className = 'citation-item';
           
           const header = document.createElement('div');
           header.className = 'citation-header';
           header.innerHTML = `<span class="citation-num">${num}</span><span class="citation-score">${score}</span>`;
           
           const contentWrap = document.createElement('div');
           contentWrap.className = 'citation-text collapsed';
           contentWrap.textContent = text;
           
           citeItem.appendChild(header);
           citeItem.appendChild(contentWrap);
           
           citeItem.addEventListener('click', () => {
               contentWrap.classList.toggle('collapsed');
           });
           
           listWrapper.appendChild(citeItem);
       });
       
       toggleBtn.addEventListener('click', () => {
           listWrapper.classList.toggle('hidden');
       });
       
       citationsContainer.appendChild(toggleBtn);
       citationsContainer.appendChild(listWrapper);
       aiGroup.appendChild(citationsContainer);
     }
  }

  answerContainer.appendChild(aiGroup);
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

if (askBtn) {
  askBtn.addEventListener('click', async () => {
    const question = (questionInput?.value || '').trim();
    const topk = topkInput?.value || '5';
    const model = (modelInput?.value || '').trim();
    const file = fileInput?.files?.[0];

    if (!question) {
      setStatus('Please type a question.');
      return;
    }

    try {
      if (!file && !__ragIngested) {
        setStatus('Please upload a document first.');
        return;
      }

      appendUserMessage(question);

      if (file && !__ragIngested) {
        setStatus('Ingesting document…');
        await ingestFile(file);
        __ragIngested = true;
      }

      setStatus('Processing…');
      const data = await askQuestion(question, topk, model);

      appendAIMessage(data);
      setStatus(''); 
    } catch (err) {
      appendAIMessage(null, 'Error: ' + (err?.message || err));
      setStatus(''); 
    }
  });
}
