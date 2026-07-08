// Fatture Management
let fatture = [];
let ddtNonFatturati = [];
let clienti = [];
let editingFattura = null;
let selectedDDT = [];

// DOM Elements
const fattureTableBody = document.getElementById('fatture-table-body');
const addFatturaBtn = document.getElementById('add-fattura-btn');
const fatturaModal = document.getElementById('fattura-modal');
const fatturaForm = document.getElementById('fattura-form');
const fatturaModalTitle = document.getElementById('fattura-modal-title');
const fatturaClienteSelect = document.getElementById('fattura-cliente');
const fatturaDDTContainer = document.getElementById('fattura-ddt-container');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    addFatturaBtn.addEventListener('click', () => openFatturaModal());
    fatturaForm.addEventListener('submit', handleFatturaSubmit);
    fatturaClienteSelect.addEventListener('change', handleClienteChange);
}

async function loadData() {
    try {
        const [fattureSnapshot, ddtSnapshot, clientiSnapshot] = await Promise.all([
            db.collection('fatture').get(),
            db.collection('ddt').where('fatturato', '==', false).get(),
            db.collection('clienti').get()
        ]);
        
        fatture = fattureSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        ddtNonFatturati = ddtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clienti = clientiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderFatture();
        populateClienteSelect();
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        fattureTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Errore caricamento dati</td></tr>';
    }
}

function renderFatture() {
    if (fatture.length === 0) {
        fattureTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nessuna fattura presente</td></tr>';
        return;
    }

    fattureTableBody.innerHTML = fatture.map(fattura => {
        const cliente = clienti.find(c => c.id === fattura.clienteId);
        return `
            <tr>
                <td>${fattura.numero}</td>
                <td>${fattura.data}</td>
                <td>${cliente?.ragioneSociale || cliente?.nome + ' ' + cliente?.cognome}</td>
                <td>${fattura.ddtIds.length} DDT</td>
                <td>€${fattura.totale}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editFattura('${fattura.id}')">Modifica</button>
                    <button class="action-btn delete-btn" onclick="deleteFattura('${fattura.id}')">Elimina</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateClienteSelect() {
    fatturaClienteSelect.innerHTML = '<option value="">Seleziona cliente</option>' + 
        clienti.map(cliente => `<option value="${cliente.id}">${cliente.ragioneSociale || cliente.nome + ' ' + cliente.cognome}</option>`).join('');
}

function handleClienteChange() {
    const clienteId = fatturaClienteSelect.value;
    selectedDDT = ddtNonFatturati.filter(ddt => ddt.clienteId === clienteId).map(ddt => ddt.id);
    renderDDTSelection();
}

function renderDDTSelection() {
    const clienteId = fatturaClienteSelect.value;
    const ddtCliente = ddtNonFatturati.filter(ddt => ddt.clienteId === clienteId);
    
    if (ddtCliente.length === 0) {
        fatturaDDTContainer.innerHTML = '<p style="color: #666;">Nessun DDT non fatturato per questo cliente</p>';
        return;
    }
    
    fatturaDDTContainer.innerHTML = ddtCliente.map(ddt => `
        <div style="padding: 10px; border: 1px solid #e0e0e0; margin-bottom: 10px; border-radius: 8px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" 
                       value="${ddt.id}" 
                       ${selectedDDT.includes(ddt.id) ? 'checked' : ''}
                       onchange="toggleDDT('${ddt.id}')"
                       style="margin-right: 10px;">
                <span><strong>DDT ${ddt.id.slice(0, 8)}...</strong> - Data: ${ddt.data} - Totale: €${ddt.totale}</span>
            </label>
        </div>
    `).join('');
}

function toggleDDT(ddtId) {
    if (selectedDDT.includes(ddtId)) {
        selectedDDT = selectedDDT.filter(id => id !== ddtId);
    } else {
        selectedDDT.push(ddtId);
    }
}

function openFatturaModal(fattura = null) {
    editingFattura = fattura;
    fatturaModalTitle.textContent = fattura ? 'Modifica Fattura' : 'Nuova Fattura';
    selectedDDT = fattura ? [...fattura.ddtIds] : [];
    
    if (fattura) {
        document.getElementById('fattura-numero').value = fattura.numero;
        document.getElementById('fattura-data').value = fattura.data;
        document.getElementById('fattura-cliente').value = fattura.clienteId;
    } else {
        document.getElementById('fattura-data').value = new Date().toISOString().split('T')[0];
        fatturaForm.reset();
    }
    
    renderDDTSelection();
    fatturaModal.classList.add('active');
}

function closeFatturaModal() {
    fatturaModal.classList.remove('active');
    editingFattura = null;
    selectedDDT = [];
    fatturaForm.reset();
}

async function handleFatturaSubmit(e) {
    e.preventDefault();
    
    if (selectedDDT.length === 0) {
        alert('Seleziona almeno un DDT');
        return;
    }
    
    const ddtSelezionati = ddtNonFatturati.filter(ddt => selectedDDT.includes(ddt.id));
    const totale = ddtSelezionati.reduce((sum, ddt) => sum + parseFloat(ddt.totale), 0);
    
    const fatturaData = {
        numero: document.getElementById('fattura-numero').value,
        data: document.getElementById('fattura-data').value,
        clienteId: document.getElementById('fattura-cliente').value,
        ddtIds: selectedDDT,
        totale,
        createdAt: new Date()
    };

    try {
        if (editingFattura) {
            await db.collection('fatture').doc(editingFattura.id).update(fatturaData);
        } else {
            const fatturaRef = await db.collection('fatture').add(fatturaData);
            
            // Mark DDT as fatturato
            for (const ddtId of selectedDDT) {
                await db.collection('ddt').doc(ddtId).update({
                    fatturato: true,
                    fatturaId: fatturaRef.id
                });
            }
        }
        
        closeFatturaModal();
        loadData();
    } catch (error) {
        console.error('Errore salvataggio fattura:', error);
        alert('Errore salvataggio fattura');
    }
}

async function deleteFattura(id) {
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) return;
    
    try {
        await db.collection('fatture').doc(id).delete();
        loadData();
    } catch (error) {
        console.error('Errore eliminazione fattura:', error);
        alert('Errore eliminazione fattura');
    }
}

function editFattura(id) {
    const fattura = fatture.find(f => f.id === id);
    if (fattura) {
        openFatturaModal(fattura);
    }
}
