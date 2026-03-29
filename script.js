document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            button.classList.add('active');
            const targetTabId = button.getAttribute('data-tab');
            const targetPane = document.getElementById(targetTabId);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // --- 2. Dictation (Web Speech API) Logic ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-IN'; // Optimized for Indian English

        let activeInput = null;
        let activeBtn = null;
        const micButtons = document.querySelectorAll('.mic-btn');

        micButtons.forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                if (this.classList.contains('recording')) {
                    recognition.stop();
                    return;
                }
                micButtons.forEach(b => b.classList.remove('recording'));

                const targetId = this.getAttribute('data-target');
                activeInput = document.getElementById(targetId);
                activeBtn = this;

                activeBtn.classList.add('recording');
                recognition.start();
            });
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (activeInput) {
                activeInput.value += (activeInput.value.length > 0 ? ' ' : '') + transcript;
            }
        };

        recognition.onspeechend = () => {
            recognition.stop();
            if (activeBtn) activeBtn.classList.remove('recording');
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (activeBtn) activeBtn.classList.remove('recording');
        };
    } else {
        alert("Your browser does not support the Web Speech API. Please use Google Chrome.");
    }

    // --- 3. Witness Statement Storage Logic ---
    let part2Witnesses = [];
    const addWitnessBtn = document.getElementById('add-witness-btn');
    const witnessList = document.getElementById('witness-list');

    if (addWitnessBtn) {
        addWitnessBtn.addEventListener('click', () => {
            const lw = document.getElementById('witness-lw').value.trim();
            const name = document.getElementById('witness-name').value.trim();
            const parent = document.getElementById('witness-parent').value.trim();
            const address = document.getElementById('witness-address').value.trim();
            const statement = document.getElementById('witness-statement').value.trim();

            if (!lw || !name || !statement) {
                alert("Please fill in at least the L.W. Number, Name, and Statement.");
                return;
            }

            const witnessData = { id: Date.now(), lw, name, parent, address, statement };
            part2Witnesses.push(witnessData);
            renderWitnessList();

            // Clear inputs for next entry
            document.getElementById('witness-lw').value = '';
            document.getElementById('witness-name').value = '';
            document.getElementById('witness-parent').value = '';
            document.getElementById('witness-address').value = '';
            document.getElementById('witness-statement').value = '';
        });
    }

    function renderWitnessList() {
        witnessList.innerHTML = '';
        part2Witnesses.forEach(witness => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="witness-info">${witness.lw} - ${witness.name}</div>
                <button class="remove-btn" onclick="removeWitness(${witness.id})">Remove</button>
            `;
            witnessList.appendChild(li);
        });
    }

    window.removeWitness = function (id) {
        part2Witnesses = part2Witnesses.filter(w => w.id !== id);
        renderWitnessList();
    };
});