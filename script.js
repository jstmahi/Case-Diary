// --- CONFIG & STATE ---
const APP_VERSION = '1.0';
let part2Witnesses = [];

// --- STORAGE MANAGER ---
const StorageManager = {
    save: function (key, value) {
        sessionStorage.setItem(`cfd_${key}`, value);
    },
    load: function (key) {
        return sessionStorage.getItem(`cfd_${key}`);
    },
    clearAll: function () {
        sessionStorage.clear();
        part2Witnesses = [];
    },
    verifyVersion: function () {
        const storedVersion = this.load('version');
        if (storedVersion !== APP_VERSION) {
            this.clearAll();
            this.save('version', APP_VERSION);
        }
    },
    saveWitnesses: function () {
        this.save('witnesses', JSON.stringify(part2Witnesses));
    },
    loadWitnesses: function () {
        const data = this.load('witnesses');
        if (data) {
            try {
                part2Witnesses = JSON.parse(data);
                return;
            } catch (e) {
                console.error("Failed to parse witnesses from storage");
            }
        }
        part2Witnesses = [];
    }
};

// --- UTILS ---
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3500);
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function validateBasicInfo() {
    const crimeNo = document.getElementById('crime-no').value.trim();
    if (!crimeNo) {
        showToast("Crime Number is required before generating documents.", "error");
        document.getElementById('crime-no').focus();
        return false;
    }
    return true;
}

// --- CORE LOGIC ---
document.addEventListener('DOMContentLoaded', () => {

    StorageManager.verifyVersion();
    StorageManager.loadWitnesses();

    const inputsToTrack = document.querySelectorAll('input[type="text"], input[type="datetime-local"], textarea');

    // 1. Initial Load from Storage & Setup Auto-Resize
    inputsToTrack.forEach(input => {
        if (input.id && input.id !== 'fileFIR' && input.id !== 'fileComplaint' && input.id !== 'fileStatements') {
            const savedValue = StorageManager.load(input.id);
            if (savedValue !== null) {
                input.value = savedValue;
            }
        }

        if (input.tagName.toLowerCase() === 'textarea') {
            input.addEventListener('input', function () {
                autoResizeTextarea(this);
            });
            // Initial resize after load
            setTimeout(() => autoResizeTextarea(input), 50);
        }
    });

    renderWitnessList();

    // 2. Debounced Auto-Save for Inputs
    const saveInputState = debounce((input) => {
        if (input.id) StorageManager.save(input.id, input.value);
    }, 1000); // Wait 1 second after typing stops before saving

    inputsToTrack.forEach(input => {
        input.addEventListener('input', (e) => saveInputState(e.target));
    });

    // 3. Dynamic Preamble Live Updates
    const basicInfoFields = ['sections-of-law', 'complainant-name', 'complaintBody'];
    basicInfoFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', generatePreamble);
        }
    });

    // --- TAB SWITCHING (Accessibility integrated in HTML) ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                pane.setAttribute('hidden', 'true');
            });

            // Activate clicked
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            const targetPane = document.getElementById(button.getAttribute('aria-controls'));
            if (targetPane) {
                targetPane.classList.add('active');
                targetPane.removeAttribute('hidden');
            }
        });

        // Keyboard Support for Tabs
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                button.click();
            }
        });
    });

    // --- DICTATION LOGIC ---
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

        recognition.onresult = (e) => {
            activeInput.value += (activeInput.value.length > 0 ? ' ' : '') + e.results[0][0].transcript;
            autoResizeTextarea(activeInput);
            saveInputState(activeInput);
        };
        recognition.onspeechend = () => { recognition.stop(); if (activeBtn) activeBtn.classList.remove('recording'); };
        recognition.onerror = () => { showToast("Microphone error. Please check permissions.", "error"); if (activeBtn) activeBtn.classList.remove('recording'); };
    }

    // --- FILE UPLOADS ---
    function handleFileUpload(event, targetId) {
        const file = event.target.files[0];
        if (!file) return;
        let statusSpan = event.target.nextElementSibling;
        if (statusSpan) statusSpan.innerText = `Loading...`;

        const processText = (text) => {
            const targetArea = document.getElementById(targetId);
            targetArea.value = text;
            autoResizeTextarea(targetArea);
            StorageManager.save(targetId, text);
            if (statusSpan) statusSpan.innerText = "Loaded ✔️";
        };

        if (file.name.endsWith('.docx')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                mammoth.extractRawText({ arrayBuffer: e.target.result })
                    .then(result => processText(result.value))
                    .catch(err => showToast("Error reading DOCX file.", "error"));
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = e => processText(e.target.result);
            reader.readAsText(file);
        }
    }

    document.getElementById('fileFIR').addEventListener('change', (e) => handleFileUpload(e, 'firRaw'));
    document.getElementById('fileComplaint').addEventListener('change', (e) => handleFileUpload(e, 'complaintRaw'));
    document.getElementById('fileStatements').addEventListener('change', (e) => handleFileUpload(e, 'statementsRaw'));

    // --- TRANSLATE & EXTRACT API ---
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
            showToast("Translation service unavailable. Using original text.", "error");
            return text;
        }
    }

    function generatePreamble() {
        let sec = document.getElementById('sections-of-law').value || "[Sections]";
        let compName = document.getElementById('complainant-name').value || "[Complainant]";
        let preamble = `I submit that this is a case involving offence U/s ${sec}. The complainant ${compName} presented a written complaint which runs as follows:`;

        const preambleBox = document.getElementById('preambleBox');
        preambleBox.value = preamble;
        StorageManager.save('preambleBox', preamble);

        let compBody = document.getElementById('complaintBody').value;
        if (compBody) {
            const gistBox = document.getElementById('investigation-gist');
            gistBox.value = `${preamble}\n\n"${compBody}"\n\nBasing on the above complaint, I registered a case and took up investigation.`;
            autoResizeTextarea(gistBox);
            StorageManager.save('investigation-gist', gistBox.value);
        }
    }

    document.getElementById('btn-translate-extract').addEventListener('click', async () => {
        let firRaw = document.getElementById('firRaw').value;
        let compRaw = document.getElementById('complaintRaw').value;

        if (!firRaw && !compRaw) {
            showToast("Please upload FIR or Complaint first.", "error");
            return;
        }

        document.getElementById('loader').style.display = 'block';

        if (compRaw) {
            const translated = await translateText(compRaw);
            document.getElementById('complaintBody').value = translated;
            StorageManager.save('complaintBody', translated);
        }

        if (firRaw) {
            let crMatch = firRaw.match(/Cr\.?No\.?\s*[:\-]?\s*(\d+\/\d{4})/i) || firRaw.match(/FIR No\.\s*[:\-]?\s*(\d+\/\d{4})/i);
            if (crMatch) {
                document.getElementById('crime-no').value = crMatch[1].trim();
                StorageManager.save('crime-no', crMatch[1].trim());
            }

            let secMatch = firRaw.match(/U\/s\s*[:\-]?\s*(.*?)(?=\n|Date)/i) || firRaw.match(/Act & Section.*?:(.*?)(?=\n|3\.)/is);
            if (secMatch) {
                document.getElementById('sections-of-law').value = secMatch[1].trim();
                StorageManager.save('sections-of-law', secMatch[1].trim());
            }

            let c2 = firRaw.match(/Name of the Complainant.*?[:\-]\s*(.*?)\n/i);
            if (c2) {
                document.getElementById('complainant-name').value = c2[1].trim();
                StorageManager.save('complainant-name', c2[1].trim());
            }
        }

        generatePreamble();
        document.getElementById('loader').style.display = 'none';
        showToast("Translation & Auto-Fill Completed!");
    });

    document.getElementById('btn-extract-gists').addEventListener('click', async () => {
        let raw = document.getElementById('statementsRaw').value;
        if (!raw) { showToast("Please upload statements document first.", "error"); return; }

        document.getElementById('loader').style.display = 'block';
        let engText = await translateText(raw);
        let blocks = engText.split(/(?=LW\s*-\s*\d+|L\.W\.\s*\d+)/i);
        let extractedCount = 0;

        blocks.forEach(block => {
            let match = block.match(/(?:LW\s*-\s*|L\.W\.\s*)(\d+)[\s:]+(.*?)(?:\n|$)/i);
            if (match) {
                extractedCount++;
                let lwNum = `L.W. ${match[1]}`;
                let nameStr = match[2].replace(/^(is|namely|:)/i, "").trim();
                let gistBody = block.replace(match[0], "").replace(/on examination (he|she) stated that/gi, "He stated that").trim();

                part2Witnesses.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random().toString(),
                    lw: lwNum,
                    name: nameStr,
                    parent: "",
                    address: "",
                    statement: gistBody
                });
            }
        });

        StorageManager.saveWitnesses();
        renderWitnessList();
        document.getElementById('loader').style.display = 'none';

        if (extractedCount > 0) {
            showToast(`${extractedCount} Witness Gists Extracted!`);
        } else {
            showToast("Could not identify witness formats in the text.", "error");
        }
    });

    // --- WITNESS MANAGEMENT ---
    document.getElementById('add-witness-btn').addEventListener('click', () => {
        const lw = document.getElementById('witness-lw').value.trim();
        const name = document.getElementById('witness-name').value.trim();
        const parent = document.getElementById('witness-parent').value.trim();
        const address = document.getElementById('witness-address').value.trim();
        const statement = document.getElementById('witness-statement').value.trim();

        if (!lw || !name || !statement) {
            showToast("L.W. Number, Name, and Statement are required.", "error");
            return;
        }

        part2Witnesses.push({
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            lw, name, parent, address, statement
        });

        StorageManager.saveWitnesses();
        renderWitnessList();
        showToast(`Saved ${lw} successfully.`);

        // Clear inputs
        ['witness-lw', 'witness-name', 'witness-parent', 'witness-address', 'witness-statement'].forEach(id => {
            const el = document.getElementById(id);
            el.value = '';
            StorageManager.save(id, ''); // Sync cleared state
            if (el.tagName.toLowerCase() === 'textarea') autoResizeTextarea(el);
        });
    });

    function renderWitnessList() {
        const witnessList = document.getElementById('witness-list');
        witnessList.innerHTML = '';
        part2Witnesses.forEach(witness => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="witness-info">${witness.lw} - ${witness.name}</div>
                <button class="remove-btn" type="button" data-id="${witness.id}">Remove</button>
            `;
            witnessList.appendChild(li);
        });
    }

    // Event Delegation for dynamically created remove buttons
    document.getElementById('witness-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const idToRemove = e.target.getAttribute('data-id');
            part2Witnesses = part2Witnesses.filter(w => w.id !== idToRemove);
            StorageManager.saveWitnesses();
            renderWitnessList();
            showToast("Witness removed.");
        }
    });

    // --- CLEAR DRAFT (SECURITY FEATURE) ---
    document.getElementById('clear-draft-btn')?.addEventListener('click', () => {
        if (confirm("Are you sure you want to securely clear all drafts and reset the form?")) {
            StorageManager.clearAll();

            const form = document.getElementById('main-draft-form');
            if (form) form.reset();

            // Reset UI State explicitly
            document.querySelectorAll('span.helper-text').forEach(s => s.innerText = "No file");
            renderWitnessList();

            // Reset textarea heights
            document.querySelectorAll('textarea').forEach(t => t.style.height = 'auto');
            showToast("Draft securely cleared.");
        }
    });

    // --- WORD DOCUMENT GENERATORS ---
    function downloadDoc(htmlContent, prefix) {
        if (!validateBasicInfo()) return;
        let cr = document.getElementById('crime-no').value.replace(/\//g, '_');
        let filename = `${prefix}_${cr}.doc`;

        var header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; } p { text-align: justify; text-indent: 40px; margin-bottom: 10px; }</style></head><body>";
        var sourceHTML = header + htmlContent + "</body></html>";
        var blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);

        showToast(`Downloaded ${filename} successfully!`);
    }

    function getBasicHeader() {
        let ps = document.getElementById('ps-name').value || "PS";
        let cr = document.getElementById('crime-no').value || "___";
        let dist = document.getElementById('district').value || "Dist";
        return `<p style="text-align:justify; font-weight:bold; text-indent:0;">${ps} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Cr.No.${cr} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${dist}</p><hr>`;
    }

    document.getElementById('generate-part1').addEventListener('click', () => {
        let gist = document.getElementById('investigation-gist').value.replace(/\n/g, '<br>');
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0;">CASE DIARY PART – I</p>` + getBasicHeader() + `<p>${gist}</p>`;
        downloadDoc(html, 'Part_I_CD');
    });

    document.getElementById('generate-part2').addEventListener('click', () => {
        if (part2Witnesses.length === 0) { showToast("No witnesses recorded.", "error"); return; }
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0;">PART - II C.D. (STATEMENTS OF WITNESSES)</p>` + getBasicHeader();
        part2Witnesses.forEach(w => {
            html += `<p style="text-indent:0; margin-bottom: 5px;"><b>Statement of ${w.lw}: ${w.name} ${w.parent ? ', ' + w.parent : ''} ${w.address ? ', ' + w.address : ''}</b></p>`;
            html += `<p>${w.statement.replace(/\n/g, '<br>')}</p><br>`;
        });
        downloadDoc(html, 'Part_II_CD');
    });

    document.getElementById('generate-mahazzar').addEventListener('click', () => {
        let p1 = document.getElementById('panchayatdar1').value;
        let p2 = document.getElementById('panchayatdar2').value;
        let east = document.getElementById('boundary-east').value;
        let west = document.getElementById('boundary-west').value;
        let north = document.getElementById('boundary-north').value;
        let south = document.getElementById('boundary-south').value;
        let desc = document.getElementById('scene-description').value.replace(/\n/g, '<br>');

        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0; text-decoration: underline;">SCENE OBSERVATION MAHAZZAR</p>` + getBasicHeader();
        html += `<p style="text-indent:0;"><b>Panchayatdars:</b><br>1. ${p1}<br>2. ${p2}</p><br>`;
        html += `<p style="text-indent:0;"><b>Scene Boundaries:</b><br><b>East:</b> ${east}<br><b>West:</b> ${west}<br><b>North:</b> ${north}<br><b>South:</b> ${south}</p><br>`;
        html += `<p style="text-indent:0;"><b>Detailed Observation:</b></p><p>${desc}</p>`;
        downloadDoc(html, 'Mahazzar');
    });

    document.getElementById('generate-arrest-memo').addEventListener('click', () => {
        let name = document.getElementById('accused-name').value;
        let parent = document.getElementById('accused-parent').value;
        let address = document.getElementById('accused-address').value;
        let dt = document.getElementById('arrest-date-time').value;
        let loc = document.getElementById('arrest-location').value;

        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-indent:0; text-decoration: underline;">ARREST MEMO</p>` + getBasicHeader();
        html += `<p style="text-indent:0;"><b>Details of the Accused:</b><br>Name & Age: ${name}<br>Father/Husband: ${parent}<br>Address: ${address}</p><br>`;
        html += `<p style="text-indent:0;"><b>Arrest Specifics:</b><br>Date & Time: ${dt}<br>Place of Arrest: ${loc}</p>`;
        downloadDoc(html, 'Arrest_Memo');
    });

    document.getElementById('generate-remand-report').addEventListener('click', () => {
        let conf = document.getElementById('confession-statement').value.replace(/\n/g, '<br>');
        let html = `<p style="text-align:center; font-weight:bold; font-size: 16px; text-decoration: underline; text-indent:0;">REMAND REPORT</p>` + getBasicHeader();
        html += `<p style="text-indent:0;"><b>Accused:</b> ${document.getElementById('accused-name').value}, ${document.getElementById('accused-parent').value}, ${document.getElementById('accused-address').value}</p>`;
        html += `<p style="text-indent:0;"><b>Arrest Details:</b> Arrested on ${document.getElementById('arrest-date-time').value} at ${document.getElementById('arrest-location').value}.</p><br>`;
        html += `<p style="text-indent:0;"><b>Confession Statement:</b></p><p>${conf}</p>`;
        downloadDoc(html, 'Remand_Report');
    });
});
