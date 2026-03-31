document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let part2Witnesses = [];

    // --- UI UX HELPERS ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Add an icon based on type
        const icon = type === 'success' ? '✓' : '⚠️';
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        
        container.appendChild(toast);
        
        // Auto-remove element from DOM after animation completes
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3500);
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

    // --- TAB SWITCHING ---
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
        recognition.onresult = (e) => { activeInput.value += (activeInput.value.length > 0 ? ' ' : '') + e.results[0][0].transcript; };
        recognition.onspeechend = () => { recognition.stop(); if (activeBtn) activeBtn.classList.remove('recording'); };
        recognition.onerror = () => { showToast("Microphone error. Please check permissions.", "error"); if (activeBtn) activeBtn.classList.remove('recording'); };
    }

    // --- FILE UPLOADS ---
    function handleFileUpload(event, targetId) {
        const file = event.target.files[0];
        if (!file) return;
        let statusSpan = event.target.nextElementSibling;
        if (statusSpan) statusSpan.innerText = `Loading...`;

        if (file.name.endsWith('.docx')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                mammoth.extractRawText({ arrayBuffer: e.target.result }).then(function (result) {
                    document.getElementById(targetId).value = result.value;
                    if (statusSpan) statusSpan.innerText = "Loaded ✔️";
                }).catch(err => showToast("Error reading DOCX file.", "error"));
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById(targetId).value = e.target.result;
                if (statusSpan) statusSpan.innerText = "Loaded ✔️";
            };
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
        document.getElementById('preambleBox').value = preamble;

        let compBody = document.getElementById('complaintBody').value;
        if (compBody) {
            document.getElementById('investigation-gist').value = `${preamble}\n\n"${compBody}"\n\nBasing on the above complaint, I registered a case and took up investigation.`;
        }
    }

    document.getElementById('btn-translate-extract').addEventListener('click', async () => {
        let firRaw = document.getElementById('firRaw').value;
        let compRaw = document.getElementById('complaintRaw').value;
        
        if(!firRaw && !compRaw) {
            showToast("Please upload FIR or Complaint first.", "error");
            return;
        }
        
        document.getElementById('loader').style.display = 'block';

        if (compRaw) {
            document.getElementById('complaintBody').value = await translateText(compRaw);
        }

        if (firRaw) {
            let crMatch = firRaw.match(/Cr\.?No\.?\s*[:\-]?\s*(\d+\/\d{4})/i) || firRaw.match(/FIR No\.\s*[:\-]?\s*(\d+\/\d{4})/i);
            if (crMatch) document.getElementById('crime-no').value = crMatch[1].trim();

            let secMatch = firRaw.match(/U\/s\s*[:\-]?\s*(.*?)(?=\n|Date)/i) || firRaw.match(/Act & Section.*?:(.*?)(?=\n|3\.)/is);
            if (secMatch) document.getElementById('sections-of-law').value = secMatch[1].trim();

            let c2 = firRaw.match(/Name of the Complainant.*?[:\-]\s*(.*?)\n/i);
            if (c2) document.getElementById('complainant-name').value = c2[1].trim();
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
        
        part2Witnesses.push({ id: Date.now(), lw, name, parent, address, statement });
        renderWitnessList();
        showToast(`Saved ${lw} successfully.`);

        // Clear inputs
        ['witness-lw', 'witness-name', 'witness-parent', 'witness-address', 'witness-statement'].forEach(id => document.getElementById(id).value = '');
    });

    function renderWitnessList() {
        const witnessList = document.getElementById('witness-list');
        witnessList.innerHTML = '';
        part2Witnesses.forEach(witness => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="witness-info">${witness.lw} - ${witness.name}</div>
                <button class="remove-btn" data-id="${witness.id}">Remove</button>
            `;
            witnessList.appendChild(li);
        });
    }

    // Event Delegation for dynamically created remove buttons
    document.getElementById('witness-list').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const idToRemove = parseFloat(e.target.getAttribute('data-id'));
            part2Witnesses = part2Witnesses.filter(w => w.id !== idToRemove);
            renderWitnessList();
            showToast("Witness removed.");
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
