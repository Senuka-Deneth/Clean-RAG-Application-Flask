const fileInput = document.getElementById("file");
const ingestBtn = document.getElementById("ingestBtn");
const statusEl = document.getElementById("status");

const questionEl = document.getElementById("question");
const topkEl = document.getElementById("topk");
const modelEl = document.getElementById("model");
const askBtn = document.getElementById("askBtn");

const answerEl = document.getElementById("answer");
const citationsEl = document.getElementById("citations");

function setBusy(isBusy) {
    ingestBtn.disabled = isBusy;
    askBtn.disabled = isBusy;
}

// -------------- Ingest --------------
ingestBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
        statusEl.textContent = "Please choose a PDF or TXT file first.";
        return;
    }

    setBusy(true);
    statusEl.textContent = "Uploading and ingesting...";

    try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/ingest", {
            method: "POST",
            body: form
        });

        const data = await res.json();
        if (!data.ok) {
            statusEl.textContent = "Error: " + (data.error || "Unknown error");
        } else {
            statusEl.textContent = data.status;
        }
    } catch (err) {
        statusEl.textContent = "Error: " + err.message;
    } finally {
        setBusy(false);
    }
});

// -------------- Ask --------------
askBtn.addEventListener("click", async () => {
    const question = questionEl.value.trim();
    const top_k = Number(topkEl.value);
    const model = modelEl.value.trim();

    if (!question) {
        answerEl.value = "";
        citationsEl.value = "";
        statusEl.textContent = "Please type a question.";
        return;
    }

    setBusy(true);
    statusEl.textContent = "Thinking...";

    try {
        const res = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, top_k, model })
        });

        const data = await res.json();
        if (!data.ok) {
            statusEl.textContent = "Error: " + (data.error || "Unknown error");
            answerEl.value = "";
            citationsEl.value = "";
        } else {
            statusEl.textContent = "Done.";
            answerEl.value = data.answer || "";
            citationsEl.value = data.citations || "";
        }
    } catch (err) {
        statusEl.textContent = "Error: " + err.message;
    } finally {
        setBusy(false);
    }
});