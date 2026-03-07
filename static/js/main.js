// Auto-ingest on Send + better status + better error handling

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
const questionDisplay = document.getElementById('question-display');
const answerEl = document.getElementById('answer');
const citationsEl = document.getElementById('citations');

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

// Reset ingest state when picking a new file
if (fileInput) {
  fileInput.addEventListener('change', () => {
    __ragIngested = false;
    const f = fileInput.files && fileInput.files[0];
    setStatus(f ? 'File selected. Ready to ingest on Send.' : 'No file ingested yet.');
  });
}

// Read response safely (JSON if possible, else text)
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
  return data; // { ok:true, status: ... }
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
  return data; // { ok:true, answer:..., citations:... }
}

function clearAnswerUI(question) {
  if (answerContainer) answerContainer.classList.add('hidden');
  if (mainCard) mainCard.classList.remove('chat-mode');

  if (answerEl) answerEl.innerHTML = '';
  if (citationsEl) citationsEl.innerHTML = '';
  if (questionDisplay) questionDisplay.textContent = question || '';
}

function renderAnswer(data) {
  if (answerEl) answerEl.innerHTML = data.answer ? String(data.answer) : '';

  if (citationsEl) {
    citationsEl.innerHTML = '';
    const cits = data.citations;

    if (Array.isArray(cits)) {
      cits.forEach((src, idx) => {
        const span = document.createElement('span');
        span.textContent = `[${idx + 1}]`;
        span.title = typeof src === 'string' ? src : JSON.stringify(src);
        citationsEl.appendChild(span);
      });
    } else if (cits) {
      citationsEl.textContent = String(cits);
    }
  }

  if (answerContainer) answerContainer.classList.remove('hidden');
  if (mainCard) mainCard.classList.add('chat-mode');
}

// Send button
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

    clearAnswerUI(question);

    try {
      // IMPORTANT GUARD:
      // If there is no file selected AND nothing ingested yet, stop here.
      if (!file && !__ragIngested) {
        setStatus('Please upload a document first.');
        return;
      }

      // Auto-ingest if file selected and not ingested
      if (file && !__ragIngested) {
        setStatus('Ingesting document…');
        await ingestFile(file);
        __ragIngested = true;
      }

      // Ask
      setStatus('Processing…');
      const data = await askQuestion(question, topk, model);

      renderAnswer(data);
      setStatus(''); // clear after success
    } catch (err) {
      setStatus('Error: ' + (err?.message || err));
    }
  });
}
