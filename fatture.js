// Fatture Management
let fatture = [];
let ddtNonFatturati = [];
let clienti = [];
let editingFattura = null;
let selectedDDT = [];
let selectedYear = '';

// DOM Elements
const fattureTableBody = document.getElementById('fatture-table-body');
const addFatturaBtn = document.getElementById('add-fattura-btn');
const fatturaModal = document.getElementById('fattura-modal');
const fatturaForm = document.getElementById('fattura-form');
const fatturaModalTitle = document.getElementById('fattura-modal-title');
const fatturaClienteSelect = document.getElementById('fattura-cliente');
const fatturaDDTContainer = document.getElementById('fattura-ddt-container');
const fatturaYearFilter = document.getElementById('fattura-year-filter');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateYearFilter();
    loadData();
    setupEventListeners();
});

function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    
    fatturaYearFilter.innerHTML = '<option value="">Tutti gli anni</option>';
    for (let year = currentYear; year >= startYear; year--) {
        fatturaYearFilter.innerHTML += `<option value="${year}">${year}</option>`;
    }
    
    // Seleziona l'anno corrente di default
    fatturaYearFilter.value = currentYear;
    selectedYear = currentYear;
}

function filterFatturaByYear() {
    selectedYear = fatturaYearFilter.value;
    renderFatture();
}

function setupEventListeners() {
    addFatturaBtn.addEventListener('click', () => openFatturaModal());
    fatturaForm.addEventListener('submit', handleFatturaSubmit);
    fatturaClienteSelect.addEventListener('change', handleClienteChange);
}

// Funzione per generare numero progressivo Fattura
async function generateFatturaNumber() {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2);
    
    // Cerca tutte le fatture dell'anno corrente
    const fattureSnapshot = await db.collection('fatture').get();
    const allFatture = fattureSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filtra fatture dell'anno corrente
    const currentYearFatture = allFatture.filter(f => {
        const fatturaYear = new Date(f.data).getFullYear();
        return fatturaYear === currentYear;
    });
    
    // Trova il numero massimo
    let maxNumber = 0;
    currentYearFatture.forEach(f => {
        if (f.numero) {
            const parts = f.numero.split(' - ');
            if (parts.length === 2 && parts[1] === yearSuffix) {
                const num = parseInt(parts[0]);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        }
    });
    
    // Restituisci il prossimo numero
    return `${maxNumber + 1} - ${yearSuffix}`;
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
    let fattureToRender = fatture;
    
    // Filtra per anno se selezionato
    if (selectedYear) {
        fattureToRender = fatture.filter(f => {
            const fatturaYear = new Date(f.data).getFullYear();
            return fatturaYear === parseInt(selectedYear);
        });
    }
    
    if (fattureToRender.length === 0) {
        fattureTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nessuna fattura presente</td></tr>';
        return;
    }

    fattureTableBody.innerHTML = fattureToRender.map(fattura => {
        const cliente = clienti.find(c => c.id === fattura.clienteId);
        return `
            <tr>
                <td>${fattura.numero}</td>
                <td>${fattura.data}</td>
                <td>${cliente?.ragioneSociale || '-'}</td>
                <td>${fattura.ddtIds.length} DDT</td>
                <td>€${fattura.totale}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editFattura('${fattura.id}')">Modifica</button>
                    <button class="action-btn delete-btn" onclick="deleteFattura('${fattura.id}')">Elimina</button>
                    <button class="action-btn" style="background: #27ae60; color: white;" onclick="generateFatturaPDF('${fattura.id}')">PDF</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateClienteSelect() {
    fatturaClienteSelect.innerHTML = '<option value="">Seleziona cliente</option>' + 
        clienti.map(cliente => `<option value="${cliente.id}">${cliente.ragioneSociale || '-'}</option>`).join('');
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
            // Genera numero automatico solo per nuove fatture
            const numero = await generateFatturaNumber();
            fatturaData.numero = numero;
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
    if (!confirm('Sei sicuro di voler eliminare questa fattura? I DDT associati torneranno disponibili per essere fatturati.')) return;
    
    try {
        const fattura = fatture.find(f => f.id === id);
        if (fattura) {
            // Rimuovi lo stato fatturato dai DDT associati
            for (const ddtId of fattura.ddtIds) {
                await db.collection('ddt').doc(ddtId).update({ 
                    fatturato: false,
                    fatturaId: null
                });
            }
        }
        
        await db.collection('fatture').doc(id).delete();
        loadData();
        alert('Fattura eliminata con successo');
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

async function generateFatturaPDF(id) {
    const fattura = fatture.find(f => f.id === id);
    if (!fattura) return;
    
    const cliente = clienti.find(c => c.id === fattura.clienteId);
    if (!cliente) return;
    
    // Carica tutti i DDT per trovare quelli inclusi nella fattura
    const ddtSnapshot = await db.collection('ddt').get();
    const tuttiDDT = ddtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const ddtInclusi = tuttiDDT.filter(d => fattura.ddtIds.includes(d.id));
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FATTURA', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fattura N: ${fattura.numero}`, 20, 35);
    doc.text(`Data: ${fattura.data}`, 20, 42);
    
    // Cliente
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', 20, 55);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ragione Sociale: ${cliente.ragioneSociale || '-'}`, 20, 62);
    doc.text(`Indirizzo: ${cliente.indirizzo || '-'}`, 20, 69);
    doc.text(`${cliente.citta || ''} (${cliente.provincia || ''}) ${cliente.cap || ''}`, 20, 76);
    doc.text(`Telefono: ${cliente.telefono || '-'}`, 20, 83);
    doc.text(`P.IVA: ${cliente.piva || '-'}`, 20, 90);
    
    // DDT inclusi
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DDT INCLUSI', 20, 105);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let y = 115;
    
    ddtInclusi.forEach(ddt => {
        doc.text(`DDT ${ddt.id.slice(0, 8)}... - Data: ${ddt.data} - Totale: €${ddt.totale}`, 20, y);
        y += 7;
    });
    
    // Tabella articoli
    y += 10;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICOLI', 20, y);
    
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Articolo', 20, y);
    doc.text('Quantità', 100, y);
    doc.text('Prezzo', 130, y);
    doc.text('Totale', 160, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.line(20, y - 2, 180, y - 2);
    
    // Aggrega tutte le righe dai DDT
    let totaleGenerale = 0;
    ddtInclusi.forEach(ddt => {
        ddt.righe.forEach(riga => {
            y += 7;
            doc.text(riga.nomeProdotto, 20, y);
            doc.text(`${riga.quantita} ${riga.unitaMisura}`, 100, y);
            doc.text(`€${riga.prezzoUnitario}`, 130, y);
            doc.text(`€${riga.totale}`, 160, y);
            totaleGenerale += parseFloat(riga.totale);
        });
    });
    
    y += 10;
    doc.line(20, y - 2, 180, y - 2);
    
    // Totale
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTALE: €${totaleGenerale.toFixed(2)}`, 160, y + 10);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Azienda Agricola Cristina', 105, 280, { align: 'center' });
    
    doc.save(`Fattura_${fattura.numero}_${fattura.data}.pdf`);
}
