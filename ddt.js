// DDT Management
let ddt = [];
let clienti = [];
let prodotti = [];
let editingDDT = null;
let ddtRighe = [];
let selectedYear = '';

// DOM Elements
const ddtTableBody = document.getElementById('ddt-table-body');
const addDDTBtn = document.getElementById('add-ddt-btn');
const ddtModal = document.getElementById('ddt-modal');
const ddtForm = document.getElementById('ddt-form');
const ddtModalTitle = document.getElementById('ddt-modal-title');
const ddtClienteSelect = document.getElementById('ddt-cliente');
const ddtRigheContainer = document.getElementById('ddt-righe-container');
const ddtArticoloSelect = document.getElementById('ddt-articolo-select');
const ddtYearFilter = document.getElementById('ddt-year-filter');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateYearFilter();
    loadData();
    setupEventListeners();
});

function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    
    ddtYearFilter.innerHTML = '<option value="">Tutti gli anni</option>';
    for (let year = currentYear; year >= startYear; year--) {
        ddtYearFilter.innerHTML += `<option value="${year}">${year}</option>`;
    }
    
    // Seleziona l'anno corrente di default
    ddtYearFilter.value = currentYear;
    selectedYear = currentYear;
}

function filterDDTByYear() {
    selectedYear = ddtYearFilter.value;
    renderDDT();
}

function setupEventListeners() {
    addDDTBtn.addEventListener('click', () => openDDTModal());
    ddtForm.addEventListener('submit', handleDDTSubmit);
    ddtArticoloSelect.addEventListener('change', handleArticoloChange);
}

function handleArticoloChange() {
    // Rimuovo auto-compilazione prezzo dato che gli articoli non hanno più prezzo fisso
}

// Funzione per generare numero progressivo DDT
async function generateDDTNumber() {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2);
    
    // Cerca tutti i DDT dell'anno corrente
    const ddtSnapshot = await db.collection('ddt').get();
    const allDDT = ddtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filtra DDT dell'anno corrente
    const currentYearDDT = allDDT.filter(d => {
        const ddtYear = new Date(d.data).getFullYear();
        return ddtYear === currentYear;
    });
    
    // Trova il numero massimo
    let maxNumber = 0;
    currentYearDDT.forEach(d => {
        if (d.numero) {
            const parts = d.numero.split(' - ');
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
    let ddtToRender = ddt;
    
    // Filtra per anno se selezionato
    if (selectedYear) {
        ddtToRender = ddt.filter(d => {
            const ddtYear = new Date(d.data).getFullYear();
            return ddtYear === parseInt(selectedYear);
        });
    }
    
    if (ddtToRender.length === 0) {
        ddtTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nessun DDT presente</td></tr>';
        return;
    }

    ddtTableBody.innerHTML = ddtToRender.map(ddtItem => {
        const cliente = clienti.find(c => c.id === ddtItem.clienteId);
        return `
            <tr>
                <td>${ddtItem.numero || ddtItem.id.slice(0, 8)}...</td>
                <td>${ddtItem.data}</td>
                <td>${cliente?.ragioneSociale || '-'}</td>
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
        prodotti.map(prodotto => `<option value="${prodotto.id}">${prodotto.nome}</option>`).join('');
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
    
    if (!prodottoId || !quantita || isNaN(quantita)) {
        alert('Seleziona un articolo e inserisci la quantità');
        return;
    }
    
    const prodotto = prodotti.find(p => p.id === prodottoId);
    if (!prodotto) {
        alert('Prodotto non trovato');
        return;
    }
    
    const riga = {
        prodottoId,
        nomeProdotto: prodotto.nome,
        quantita,
        unitaMisura: prodotto.unitaMisura
    };
    
    ddtRighe.push(riga);
    renderDDTRighe();
    
    // Reset form fields
    ddtArticoloSelect.value = '';
    document.getElementById('ddt-quantita').value = '';
}

function renderDDTRighe() {
    ddtRigheContainer.innerHTML = ddtRighe.map((riga, index) => `
        <div style="padding: 10px; border: 1px solid #e0e0e0; margin-bottom: 10px; border-radius: 8px;">
            <strong>${riga.nomeProdotto}</strong> x ${riga.quantita} ${riga.unitaMisura}
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
    
    const ddtData = {
        clienteId: document.getElementById('ddt-cliente').value,
        data: document.getElementById('ddt-data').value,
        righe: ddtRighe,
        fatturato: false,
        createdAt: new Date()
    };

    try {
        if (editingDDT) {
            await db.collection('ddt').doc(editingDDT.id).update(ddtData);
        } else {
            // Genera numero automatico solo per nuovi DDT
            const numero = await generateDDTNumber();
            ddtData.numero = numero;
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
    
    try {
        // Carica il logo come immagine
        const logoImg = await fetch('logo.png').then(res => res.blob());
        const logoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(logoImg);
        });
        
        // Aggiungi il logo in alto a sinistra
        doc.addImage(logoDataUrl, 'PNG', 20, 10, 30, 30);
    } catch (error) {
        // Se il caricamento dell'immagine fallisce, usa il testo come fallback
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Azienda Agricola Cristina', 20, 20);
    }
    
    // Riferimenti aziendali sotto il logo
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('P.I. 01920500228', 20, 48);
    doc.text('via lung\'Adige Luigi Braille, 22', 20, 54);
    doc.text('38121 Trento', 20, 60);
    doc.text('Tel. 3333623616', 20, 66);
    doc.text('stefano.dematte@tiscali.it', 20, 72);
    
    // Titolo a destra in alto
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO', 120, 25);
    doc.text('DI TRASPORTO', 120, 32);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`N: ${ddtItem.numero}`, 120, 42);
    doc.text(`Data: ${ddtItem.data}`, 120, 49);
    
    // Linea di separazione
    doc.line(20, 78, 190, 78);
    
    // Cliente sotto
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DESTINATARIO', 20, 88);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ragione Sociale: ${cliente.ragioneSociale || '-'}`, 20, 96);
    doc.text(`Indirizzo: ${cliente.indirizzo || '-'}`, 20, 103);
    doc.text(`${cliente.citta || ''} (${cliente.provincia || ''}) ${cliente.cap || ''}`, 20, 110);
    doc.text(`Telefono: ${cliente.telefono || '-'}`, 20, 117);
    doc.text(`P.IVA: ${cliente.piva || '-'}`, 20, 124);
    
    // Linea di separazione
    doc.line(20, 130, 190, 130);
    
    // Tabella articoli
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTICOLI', 20, 140);
    
    let y = 150;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Articolo', 20, y);
    doc.text('Quantità', 140, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.line(20, y - 2, 190, y - 2);
    
    ddtItem.righe.forEach(riga => {
        y += 7;
        doc.text(riga.nomeProdotto, 20, y);
        doc.text(`${riga.quantita} ${riga.unitaMisura}`, 140, y);
        
        // Descrizione sulla riga sottostante (se presente)
        const prodotto = prodotti.find(p => p.id === riga.prodottoId);
        if (prodotto && prodotto.descrizione && prodotto.descrizione.trim()) {
            y += 5;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(prodotto.descrizione, 20, y);
            
            // Torna al font normale
            y += 5;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
        }
    });
    
    y += 10;
    doc.line(20, y - 2, 190, y - 2);
    
    doc.save(`DDT_${ddtItem.numero}_${ddtItem.data}.pdf`);
}
