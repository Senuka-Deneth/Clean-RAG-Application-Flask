// Auto-ingest on Send + continuous chat log + animations + modal citations

let __ragIngested = false;

// DOM
const fileInput = document.getElementById('file');
const questionInput = document.getElementById('question');
const topkInput = document.getElementById('topk');
const modelInput = document.getElementById('model');
const askBtn = document.getElementById('askBtn');
const mainCard = document.getElementById('main-card');
const answerContainer = document.getElementById('answer-container');
const newChatBtn = document.getElementById('newChatBtn');

if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        window.location.reload();
    });
}

// Error message hook
let statusEl = document.getElementById('error-status');
if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'error-status';
    statusEl.className = 'status-msg';
    const wrapper = document.querySelector('.glass-input-wrapper');
    if (wrapper) wrapper.appendChild(statusEl);
}

function showError(msg) {
  if (statusEl) {
      statusEl.textContent = msg;
      statusEl.style.color = '#ff453a'; 
      statusEl.style.fontWeight = '500';
  }
}
function clearError() {
  if (statusEl) statusEl.textContent = '';
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    __ragIngested = false;
    clearError();
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

function smoothScroll() {
  const anchor = document.getElementById('scroll-anchor');
  if(anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
  } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }
}

function appendUserMessage(question) {
  if (answerContainer) answerContainer.classList.remove('hidden');
  if (mainCard) mainCard.classList.add('chat-mode');

  const userGroup = document.createElement('div');
  userGroup.className = 'message-group user-group';
  
  const bubble = document.createElement('div');
  bubble.className = 'question-bubble';
  bubble.textContent = question;
  
  userGroup.appendChild(bubble);
  answerContainer.appendChild(userGroup);
  
  if(questionInput) {
    questionInput.value = '';
    questionInput.style.height = 'auto'; 
  }
  
  smoothScroll();
}

let tempAIGroup = null;
let processInterval = null;

function clearProcessing() {
    if (processInterval) {
        clearInterval(processInterval);
        processInterval = null;
    }
}

function setProcessingBubble(msgText) {
    if (!tempAIGroup) {
        tempAIGroup = document.createElement('div');
        tempAIGroup.className = 'message-group ai-group';
        
        const bubble = document.createElement('div');
        bubble.className = 'answer-bubble status-msg'; 
        bubble.style.display = 'flex';
        
        tempAIGroup.appendChild(bubble);
        answerContainer.appendChild(tempAIGroup);
    } 
    
    const bubble = tempAIGroup.querySelector('.answer-bubble');
    clearProcessing();
    
    let dots = 0;
    bubble.textContent = msgText;
    
    processInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        bubble.textContent = msgText + ".".repeat(dots);
    }, 400);
    
    smoothScroll();
}

function typeWriterEffect(element, text, speed = 10) {
    let i = 0;
    element.textContent = '';
    return new Promise(resolve => {
        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                if (i % 80 === 0) smoothScroll();
                setTimeout(type, speed);
            } else {
                smoothScroll();
                resolve();
            }
        }
        type();
    });
}

function openCitationsModal(rawCits) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const content = document.createElement('div');
    content.className = 'citations-modal-content';
    
    content.innerHTML = `
        <div class="citations-modal-header">
            <button class="close-modal-btn" title="Close">
               <svg fill="currentColor" viewBox="0 0 24 24" width="18" height="18"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
            </button>
            <span class="modal-title">Sources</span>
            <div style="width:34px;"></div>
        </div>
        <div class="citations-scroll-area"></div>
    `;
    
    const scrollArea = content.querySelector('.citations-scroll-area');
    
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
           
           citeItem.innerHTML = `
               <div class="citation-header">
                 <span class="citation-num">${num}</span>
                 <span class="citation-score">${score}</span>
               </div>
               <div class="citation-text collapsed">${text}</div>
           `;
           
           citeItem.addEventListener('click', () => {
               citeItem.querySelector('.citation-text').classList.toggle('collapsed');
           });
           
           scrollArea.appendChild(citeItem);
    });
    
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
    });
    
    function closeModal() {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 300); 
    }
    
    overlay.addEventListener('click', (e) => {
        if(e.target === overlay) closeModal();
    });
    content.querySelector('.close-modal-btn').addEventListener('click', closeModal);
}

function insertCitations(aiGroup, dataCitations) {
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
     
     let rawCits = [];
     if(typeof dataCitations === 'string') {
        rawCits = dataCitations.split('\n').filter(s => s.trim().length > 0);
     } else if(Array.isArray(dataCitations)) {
        rawCits = dataCitations;
     }

     if(rawCits.length > 0) {
       toggleBtn.addEventListener('click', () => {
           openCitationsModal(rawCits);
       });
       citationsContainer.appendChild(toggleBtn);
       aiGroup.appendChild(citationsContainer);
     }
}

function appendAIMessage(data, errorText = null) {
  clearProcessing();
  let aiGroup = tempAIGroup;
  if (aiGroup) {
      aiGroup.innerHTML = ''; 
  } else {
      aiGroup = document.createElement('div');
      aiGroup.className = 'message-group ai-group';
      answerContainer.appendChild(aiGroup);
  }
  
  const answerBubble = document.createElement('div');
  answerBubble.className = 'answer-bubble';
  aiGroup.appendChild(answerBubble);

  if (errorText) {
      answerBubble.textContent = errorText;
  } else if (data.answer) {
      typeWriterEffect(answerBubble, String(data.answer)).then(() => {
          if (data.citations) {
             insertCitations(aiGroup, data.citations);
             smoothScroll();
          }
      });
  } else {
      if (data.citations) insertCitations(aiGroup, data.citations);
  }

  tempAIGroup = null;
  smoothScroll();
}

if (askBtn) {
  askBtn.addEventListener('click', async () => {
    const question = (questionInput?.value || '').trim();
    const topk = topkInput?.value || '5';
    const targetModelInput = document.getElementById('model');
    const model = (targetModelInput?.value || '').trim();
    const file = fileInput?.files?.[0];

    if (!question) {
      showError('Please type a question.');
      return;
    }

    try {
      if (!file && !__ragIngested) {
        showError('No document uploaded! Please upload a file first.');
        return;
      }
      clearError();
      appendUserMessage(question);

      if (file && !__ragIngested) {
        setProcessingBubble('Ingesting document');
        await ingestFile(file);
        __ragIngested = true;
      }

      setProcessingBubble('Processing response');
      const data = await askQuestion(question, topk, model);

      appendAIMessage(data);
    } catch (err) {
      console.error(err);
      appendAIMessage(null, 'An error occurred while processing your request. Please try again.');
    }
  });
}

// ----------------------------------------------------
// Final Polish: Welcome Messages & Drag and Drop
// ----------------------------------------------------

// Dynamic Welcome Message
const welcomeMessages = [
    "What can I do for you?",
    "How can I assist you today?",
    "What would you like to explore?",
    "Ready to discover something new?",
    "How can I help you learn today?",
    "What answers are you seeking?",
    "Let's dive into your documents.",
    "What's on your mind today?",
    "How can I streamline your work?",
    "Ask me anything you'd like!"
];
const welcomeHeading = document.querySelector('.welcome-heading');
if(welcomeHeading) {
    const randomMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    welcomeHeading.textContent = randomMsg;
}

// Drag and Drop Logic
const glassInputWrapper = document.querySelector('.glass-input-wrapper');
if (glassInputWrapper && fileInput) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, preventDefaults, false);
        glassInputWrapper.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        glassInputWrapper.addEventListener(eventName, () => {
            glassInputWrapper.classList.add('drag-highlight');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        glassInputWrapper.addEventListener(eventName, () => {
            glassInputWrapper.classList.remove('drag-highlight');
        }, false);
    });

    glassInputWrapper.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            fileInput.files = files;
            __ragIngested = false;
            clearError();
            
            // Dispatch change event to trigger placeholder logic in index.html
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    }, false);
}
