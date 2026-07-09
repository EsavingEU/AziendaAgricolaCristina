// DDT Management
let ddt = [];
let clienti = [];
let prodotti = [];
let editingDDT = null;
let ddtRighe = [];

// DOM Elements
const ddtTableBody = document.getElementById('ddt-table-body');
const addDDTBtn = document.getElementById('add-ddt-btn');
const ddtModal = document.getElementById('ddt-modal');
const ddtForm = document.getElementById('ddt-form');
const ddtModalTitle = document.getElementById('ddt-modal-title');
const ddtClienteSelect = document.getElementById('ddt-cliente');
const ddtRigheContainer = document.getElementById('ddt-righe-container');
const ddtArticoloSelect = document.getElementById('ddt-articolo-select');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    addDDTBtn.addEventListener('click', () => openDDTModal());
    ddtForm.addEventListener('submit', handleDDTSubmit);
    ddtArticoloSelect.addEventListener('change', handleArticoloChange);
}

function handleArticoloChange() {
    const prodottoId = ddtArticoloSelect.value;
    const prodotto = prodotti.find(p => p.id === prodottoId);
    if (prodotto) {
        document.getElementById('ddt-prezzo').value = prodotto.prezzoUnitario;
    }
}

async function loadData() {
    try {
        const [ddtSnapshot, clientiSnapshot, prodottiSnapshot] = await Promise.all([
            db.collection('ddt').get(),
            db.collection('clienti').get(),
            db.collection('prodotti').get()
        ]);
        
        ddt = ddtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clienti = clientiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        prodotti = prodottiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderDDT();
        populateClienteSelect();
        populateArticoloSelect();
    } catch (error) {
        console.error('Errore caricamento dati:', error);
        ddtTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Errore caricamento dati</td></tr>';
    }
}

function renderDDT() {
    if (ddt.length === 0) {
        ddtTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nessun DDT presente</td></tr>';
        return;
    }

    ddtTableBody.innerHTML = ddt.map(ddtItem => {
        const cliente = clienti.find(c => c.id === ddtItem.clienteId);
        return `
            <tr>
                <td>${ddtItem.id.slice(0, 8)}...</td>
                <td>${ddtItem.data}</td>
                <td>${cliente?.ragioneSociale || '-'}</td>
                <td>€${ddtItem.totale}</td>
                <td>${ddtItem.fatturato ? 'Fatturato' : 'Non Fatturato'}</td>
                <td>
                    <button class="action-btn edit-btn" onclick="editDDT('${ddtItem.id}')">Modifica</button>
                    <button class="action-btn delete-btn" onclick="deleteDDT('${ddtItem.id}')">Elimina</button>
                    <button class="action-btn" style="background: #27ae60; color: white;" onclick="generateDDTPDF('${ddtItem.id}')">PDF</button>
                </td>
            </tr>
        `;
    }).join('');
}

function populateClienteSelect() {
    ddtClienteSelect.innerHTML = '<option value="">Seleziona cliente</option>' + 
        clienti.map(cliente => `<option value="${cliente.id}">${cliente.ragioneSociale || '-'}</option>`).join('');
}

function populateArticoloSelect() {
    ddtArticoloSelect.innerHTML = '<option value="">Seleziona articolo</option>' + 
        prodotti.map(prodotto => `<option value="${prodotto.id}">${prodotto.nome} - €${prodotto.prezzoUnitario}/${prodotto.unitaMisura}</option>`).join('');
}

function openDDTModal(ddtItem = null) {
    editingDDT = ddtItem;
    ddtModalTitle.textContent = ddtItem ? 'Modifica DDT' : 'Nuovo DDT';
    ddtRighe = ddtItem ? [...ddtItem.righe] : [];
    
    if (ddtItem) {
        document.getElementById('ddt-cliente').value = ddtItem.clienteId;
        document.getElementById('ddt-data').value = ddtItem.data;
    } else {
        document.getElementById('ddt-data').value = new Date().toISOString().split('T')[0];
        ddtForm.reset();
    }
    
    renderDDTRighe();
    populateArticoloSelect();
    ddtModal.classList.add('active');
}

function closeDDTModal() {
    ddtModal.classList.remove('active');
    editingDDT = null;
    ddtRighe = [];
    ddtForm.reset();
}

function addDDTRiga() {
    const prodottoId = ddtArticoloSelect.value;
    const quantita = parseFloat(document.getElementById('ddt-quantita').value);
    const prezzo = parseFloat(document.getElementById('ddt-prezzo').value);
    
    if (!prodottoId || !quantita || isNaN(quantita)) {
        alert('Seleziona un articolo e inserisci la quantità');
        return;
    }
    
    const prodotto = prodotti.find(p => p.id === prodottoId);
    if (!prodotto) {
        alert('Prodotto non trovato');
        return;
    }
    
    const prezzoUnitario = prezzo || prodotto.prezzoUnitario;
    
    const riga = {
        prodottoId,
        nomeProdotto: prodotto.nome,
        quantita,
        unitaMisura: prodotto.unitaMisura,
        prezzoUnitario,
        totale: (quantita * prezzoUnitario).toFixed(2)
    };
    
    ddtRighe.push(riga);
    renderDDTRighe();
    
    // Reset form fields
    ddtArticoloSelect.value = '';
    document.getElementById('ddt-quantita').value = '';
    document.getElementById('ddt-prezzo').value = '';
}

function renderDDTRighe() {
    ddtRigheContainer.innerHTML = ddtRighe.map((riga, index) => `
        <div style="padding: 10px; border: 1px solid #e0e0e0; margin-bottom: 10px; border-radius: 8px;">
            <strong>${riga.nomeProdotto}</strong> x ${riga.quantita} ${riga.unitaMisura} = €${riga.totale}
            <button type="button" onclick="removeDDTRiga(${index})" style="margin-left: 10px; background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Rimuovi</button>
        </div>
    `).join('');
}

function removeDDTRiga(index) {
    ddtRighe.splice(index, 1);
    renderDDTRighe();
}

async function handleDDTSubmit(e) {
    e.preventDefault();
    
    if (ddtRighe.length === 0) {
        alert('Aggiungi almeno una riga');
        return;
    }
    
    const totale = ddtRighe.reduce((sum, riga) => sum + parseFloat(riga.totale), 0);
    
    const ddtData = {
        clienteId: document.getElementById('ddt-cliente').value,
        data: document.getElementById('ddt-data').value,
        righe: ddtRighe,
        totale,
        fatturato: false,
        createdAt: new Date()
    };

    try {
        if (editingDDT) {
            await db.collection('ddt').doc(editingDDT.id).update(ddtData);
        } else {
            await db.collection('ddt').add(ddtData);
        }
        
        closeDDTModal();
        loadData();
    } catch (error) {
        console.error('Errore salvataggio DDT:', error);
        alert('Errore salvataggio DDT');
    }
}

async function deleteDDT(id) {
    if (!confirm('Sei sicuro di voler eliminare questo DDT?')) return;
    
    try {
        await db.collection('ddt').doc(id).delete();
        loadData();
    } catch (error) {
        console.error('Errore eliminazione DDT:', error);
        alert('Errore eliminazione DDT');
    }
}

function editDDT(id) {
    const ddtItem = ddt.find(d => d.id === id);
    if (ddtItem) {
        openDDTModal(ddtItem);
    }
}

async function generateDDTPDF(id) {
    const ddtItem = ddt.find(d => d.id === id);
    if (!ddtItem) return;
    
    const cliente = clienti.find(c => c.id === ddtItem.clienteId);
    if (!cliente) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO DI TRASPORTO', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`DDT N: ${ddtItem.id.slice(0, 8)}`, 20, 35);
    doc.text(`Data: ${ddtItem.data}`, 20, 42);
    
    // Cliente
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATARIO', 20, 55);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ragione Sociale: ${cliente.ragioneSociale || '-'}`, 20, 62);
    doc.text(`Indirizzo: ${cliente.indirizzo || '-'}`, 20, 69);
    doc.text(`${cliente.citta || ''} (${cliente.provincia || ''}) ${cliente.cap || ''}`, 20, 76);
    doc.text(`Telefono: ${cliente.telefono || '-'}`, 20, 83);
    doc.text(`P.IVA: ${cliente.piva || '-'}`, 20, 90);
    
    // Tabella articoli
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICOLI', 20, 105);
    
    let y = 115;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Articolo', 20, y);
    doc.text('Quantità', 100, y);
    doc.text('Prezzo', 130, y);
    doc.text('Totale', 160, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.line(20, y - 2, 180, y - 2);
    
    ddtItem.righe.forEach(riga => {
        y += 7;
        doc.text(riga.nomeProdotto, 20, y);
        doc.text(`${riga.quantita} ${riga.unitaMisura}`, 100, y);
        doc.text(`€${riga.prezzoUnitario}`, 130, y);
        doc.text(`€${riga.totale}`, 160, y);
    });
    
    y += 10;
    doc.line(20, y - 2, 180, y - 2);
    
    // Totale
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTALE: €${ddtItem.totale}`, 160, y + 10);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Azienda Agricola Cristina', 105, 280, { align: 'center' });
    
    doc.save(`DDT_${ddtItem.data}_${ddtItem.id.slice(0, 8)}.pdf`);
}
