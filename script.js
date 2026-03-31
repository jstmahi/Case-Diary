// --- GLOBAL VARIABLES ---
let part2Witnesses = [];

// --- 1. FILE UPLOAD HANDLER ---
function handleFileUpload(event, targetId) {
    const file = event.target.files[0];
    if (!file) return;
    let statusSpan = event.target.nextElementSibling;
    if (statusSpan) statusSpan.innerText = `Loading...`;

    if (file.name.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            mammoth.extractRawText({arrayBuffer: e.target.result}).then(function (result) {
                document.getElementById(targetId).value = result.value;
                if (statusSpan) statusSpan.innerText = "Loaded ✔️";
            });
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(targetId).value = e.target.result;
            if (statusSpan) statusSpan.innerText = "Loaded ✔️";
        };
        reader.readAsText(file);
    }
}

// --- 2. GOOGLE TRANSLATE API ---
async function translateText(text) {
    if (!text) return "";
    try {
        let res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=te&tl=en&dt=t`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ q: text })
        });
        let json = await res.json();
        return json[0].map(x => x[0]).join('');
    } catch (e) {
        console.error("Translation failed:", e);
        return text; 
    }
}

// --- 3. AUTO-FILL & EXTRACTION ---
async function translateAndExtract() {
    let firRaw = document.getElementById('firRaw').value;
    let compRaw = document.getElementById('complaintRaw').value;
    document.getElementById('loader').style.display = 'block';

    // Translate Complaint
    if (compRaw) {
        let engComp = await translateText(compRaw);
        document.getElementById('complaintBody').value = engComp;
    }

    // Extract from FIR
    if (firRaw) {
        let engFir = firRaw; // Assuming FIR is usually English, if not add translation here
        
        let crMatch = engFir.match(/Cr\.?No\.?\s*[:\-]?\s*(\d+\/\d{4})/i) || engFir.match(/FIR No\.\s*[:\-]?\s*(\d+\/\d{4})/i);
        if (crMatch) document.getElementById('crime-no').value = crMatch[1].trim();

        let secMatch = engFir.match(/U\/s\s*[:\-]?\s*(.*?)(?=\n|Date)/i) || engFir.match(/Act & Section.*?:(.*?)(?=\n|3\.)/is);
        if (secMatch) document.getElementById('sections-of-law').value = secMatch[1].trim();

        let c2 = engFir.match(/Name of the Complainant.*?[:\-]\s*(.*?)\n/i);
        if (c2) document.getElementById('complainant-name').value = c2[1].trim();
    }

    generatePreamble();
    document.getElementById('loader').style.display = 'none';
    alert("Translation & Auto-Fill Completed!");
}

function generatePreamble() {
    let sec = document.getElementById('sections-of-law').value || "[Sections]";
    let compName = document.getElementById('complainant-name').value || "[Complainant]";
    let preamble = `I submit that this is a case involving offence U/s ${sec}. The complainant ${compName} presented a written complaint which runs as follows:`;
    document.getElementById('preambleBox').value = preamble;
    
    // Pre-fill the Part-1 investigation gist with the preamble and complaint
    let compBody = document.getElementById('complaintBody').value;
    if(compBody) {
        document.getElementById('investigation-gist').value = `${preamble}\n\n"${compBody}"\n\nBasing on the above complaint, I registered a case and took up investigation.`;
    }
}

// --- 4. GIST EXTRACTOR (Modified for Array Storage) ---
async function extractGists() {
    let raw = document.getElementById('statementsRaw').value;
    if (!raw) { alert("Please upload statements document first."); return; }

    document.getElementById('loader').style.display = 'block';
    let engText = await translateText(raw);

    let blocks = engText.split(/(?=LW\s*-\s*\d+|L\.W\.\s*\d+)/i);
    blocks.forEach(block => {
        let match = block.match(/(?:LW\s*-\s*|L\.W\.\s*)(\d+)[\s:]+(.*?)(?:\n|$)/i);
        if (match) {
            let lwNum = `L.W. ${match[1]}`;
            let nameStr = match[2].replace(/^(is|namely|:)/i, "").trim();
            let gistBody = block.replace(match[0], "").replace(/on examination (he|she) stated that/gi, "He stated that").trim();

            part2Witnesses.push({ 
                id: Date.now() + Math.random(), 
                lw: lwNum, 
                name: nameStr, 
                parent: "", 
                address: "", 
                statement: gistBody 
            });
        }
    });
    
    renderWitnessList();
    document.getElementById('loader').style.display = 'none';
    alert("Witness Gists Extracted Successfully!");
}

// --- 5. CORE UI LOGIC (Tabs, Dictation, Witness List) ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Tab Switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.getAttribute('data-tab')).classList.add('active');
        });
    });

    // Dictation Logic
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-IN'; 
        let activeInput = null, activeBtn = null;
        
        document.querySelectorAll('.mic-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                if (this.classList.contains('recording')) { recognition.stop(); return; }
                document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
                activeInput = document.getElementById(this.getAttribute('data-target'));
                activeBtn = this;
                activeBtn.classList.add('recording');
                recognition.start();
            });
        });
        recognition.onresult = (e) => { activeInput.value += (activeInput.value.length > 0 ? ' ' : '') + e.results[0][0].transcript; };
        recognition.onspeechend = () => { recognition.stop(); if (activeBtn) activeBtn.classList.remove('recording'); };
        recognition.onerror = () => { if (activeBtn) activeBtn.classList.remove('recording'); };
    }

    // Manual Witness Entry
    const addWitnessBtn = document.getElementById('add-witness-btn');
    if (addWitnessBtn) {
        addWitnessBtn.addEventListener('click', () => {
            const lw = document.getElementById('witness-lw').value.trim();
            const name = document.getElementById('witness-name').value.trim();
            const parent = document.getElementById('witness-parent').value.trim();
            const address = document.getElementById('witness-address').value.trim();
            const statement = document.getElementById('witness-statement').value.trim();

            if (!lw || !name || !statement) { alert("Fill L.W. Number, Name, and Statement."); return; }
            part2Witnesses.push({ id: Date.now(), lw, name, parent, address, statement });
            renderWitnessList();
            
            // Clear
            ['witness-lw', 'witness-name', 'witness-parent', 'witness-address', 'witness-statement'].forEach(id => document.getElementById(id).value = '');
        });
    }

    // --- 6. WORD DOCUMENT GENERATORS ---
    function downloadDoc(htmlContent, filename) {
        var header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; } p { text-align: justify; text-indent: 40px; margin-bottom: 10px; }</style></head><body>";
        var sourceHTML = header + htmlContent + "</body></html>";
        var blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function getBasicHeader() {
        let ps = document.getElementById('ps-name').value;
        let cr = document.getElementById('crime-no').value;
        let dist = document.getElementById('district').value;
        return `<p style="text-align:justify; font-weight:bold; text-indent:0;">${ps} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Cr.No.${cr} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${dist}</p><hr>`;
    }

    document.getElementById('generate-part1').addEventListener('click', () => {
        let gist = document.getElementById('investigation-gist').value.replace(/\n/g, '<br>');
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0;">CASE DIARY PART – I</p>` + getBasicHeader() + `<p>${gist}</p>`;
        downloadDoc(html, `Part_I_CD_${document.getElementById('crime-no').value.replace('/', '_')}.doc`);
    });

    document.getElementById('generate-part2').addEventListener('click', () => {
        if(part2Witnesses.length === 0) { alert("No witnesses recorded."); return; }
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0;">PART - II C.D. (STATEMENTS OF WITNESSES)</p>` + getBasicHeader();
        part2Witnesses.forEach(w => {
            html += `<p style="text-indent:0; margin-bottom: 5px;"><b>Statement of ${w.lw}: ${w.name} ${w.parent ? ', '+w.parent : ''} ${w.address ? ', '+w.address : ''}</b></p>`;
            html += `<p>${w.statement.replace(/\n/g, '<br>')}</p><br>`;
        });
        downloadDoc(html, `Part_II_CD_${document.getElementById('crime-no').value.replace('/', '_')}.doc`);
    });

    document.getElementById('generate-remand-report').addEventListener('click', () => {
        let conf = document.getElementById('confession-statement').value.replace(/\n/g, '<br>');
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-decoration: underline; text-indent:0;">REMAND REPORT</p>` + getBasicHeader();
        html += `<p>Accused: ${document.getElementById('accused-name').value}, ${document.getElementById('accused-parent').value}, ${document.getElementById('accused-address').value}</p>`;
        html += `<p>Arrested on ${document.getElementById('arrest-date-time').value} at ${document.getElementById('arrest-location').value}.</p>`;
        html += `<p><b>Confession:</b><br>${conf}</p>`;
        downloadDoc(html, `Remand_Report_${document.getElementById('crime-no').value.replace('/', '_')}.doc`);
    });
});

function renderWitnessList() {
    const witnessList = document.getElementById('witness-list');
    witnessList.innerHTML = '';
    part2Witnesses.forEach(witness => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="witness-info">${witness.lw} - ${witness.name}</div><button class="remove-btn" onclick="removeWitness(${witness.id})">Remove</button>`;
        witnessList.appendChild(li);
    });
}
