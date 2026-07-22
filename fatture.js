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

// Check authentication
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('Utente autenticato:', user.email);
        loadData();
    } else {
        console.log('Utente non autenticato, reindirizzamento...');
        window.location.href = 'index.html';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateYearFilter();
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
        fattureTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nessuna fattura presente</td></tr>';
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
                <td>€${fattura.totaleImponibile || fattura.totale}</td>
                <td>€${fattura.iva || '0.00'}</td>
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
    // Deseleziona tutti i DDT quando cambia il cliente
    selectedDDT = [];
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
            <label style="display: flex; align-items: center; cursor: pointer; width: 100%;">
                <input type="checkbox" 
                       value="${ddt.id}" 
                       ${selectedDDT.includes(ddt.id) ? 'checked' : ''}
                       onchange="toggleDDT('${ddt.id}')"
                       style="margin-right: 15px; flex-shrink: 0; width: 16px; height: 16px;">
                <span style="flex: 1;"><strong>DDT ${ddt.numero}</strong> - Data: ${ddt.data} - Totale: €${ddt.totale}</span>
            </label>
        </div>
    `).join('');
}

function renderFatturaRighe() {
    const container = document.getElementById('fattura-righe-container');
    const list = document.getElementById('fattura-righe-list');
    
    if (selectedDDT.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    
    const ddtSelezionati = ddtNonFatturati.filter(ddt => selectedDDT.includes(ddt.id));
    
    let html = '';
    ddtSelezionati.forEach(ddt => {
        html += `<div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 8px;">
            <strong>DDT ${ddt.numero} - ${ddt.data}</strong>
            <div style="margin-top: 10px;">`;
        
        ddt.righe.forEach((riga, index) => {
            const hasPrice = riga.prezzoUnitario && riga.prezzoUnitario > 0;
            html += `
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; margin-bottom: 5px; align-items: center;">
                    <div style="font-size: 12px;">${riga.nomeProdotto} (${riga.quantita} ${riga.unitaMisura})</div>
                    <div style="font-size: 12px;">Prezzo DDT: €${hasPrice ? riga.prezzoUnitario : '0.00'}</div>
                    <div>
                        <input type="number" 
                               id="prezzo-${ddt.id}-${index}" 
                               value="${hasPrice ? riga.prezzoUnitario : ''}" 
                               step="0.01" 
                               placeholder="Prezzo fattura"
                               style="width: 100%; padding: 5px; font-size: 12px;"
                               ${hasPrice ? 'readonly' : ''}>
                    </div>
                    <div style="font-size: 12px; color: ${hasPrice ? 'green' : 'red'};">
                        ${hasPrice ? '✓ Prezzo presente' : '⚠ Inserisci prezzo'}
                    </div>
                </div>`;
        });
        
        html += `</div></div>`;
    });
    
    list.innerHTML = html;
}

function toggleDDT(ddtId) {
    if (selectedDDT.includes(ddtId)) {
        selectedDDT = selectedDDT.filter(id => id !== ddtId);
    } else {
        selectedDDT.push(ddtId);
    }
    renderFatturaRighe();
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
    
    // Valida che tutte le righe abbiano prezzi
    let righeFattura = [];
    let prezziMancanti = false;
    
    ddtSelezionati.forEach(ddt => {
        ddt.righe.forEach((riga, index) => {
            const hasPrice = riga.prezzoUnitario && riga.prezzoUnitario > 0;
            let prezzoFattura;
            
            if (hasPrice) {
                prezzoFattura = riga.prezzoUnitario;
            } else {
                const prezzoInput = document.getElementById(`prezzo-${ddt.id}-${index}`);
                prezzoFattura = parseFloat(prezzoInput.value);
                
                if (!prezzoFattura || isNaN(prezzoFattura)) {
                    prezziMancanti = true;
                    return;
                }
            }
            
            righeFattura.push({
                prodottoId: riga.prodottoId,
                nomeProdotto: riga.nomeProdotto,
                quantita: riga.quantita,
                unitaMisura: riga.unitaMisura,
                prezzoUnitario: prezzoFattura,
                totale: (riga.quantita * prezzoFattura).toFixed(2),
                ddtId: ddt.id
            });
        });
    });
    
    if (prezziMancanti) {
        alert('Inserisci tutti i prezzi mancanti nelle righe della fattura');
        return;
    }
    
    const totaleImponibile = righeFattura.reduce((sum, riga) => sum + parseFloat(riga.totale), 0);
    const iva = totaleImponibile * 0.04;
    const totale = totaleImponibile + iva;
    
    const fatturaData = {
        data: document.getElementById('fattura-data').value,
        clienteId: document.getElementById('fattura-cliente').value,
        ddtIds: selectedDDT,
        righe: righeFattura,
        totaleImponibile,
        iva,
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
    
    let currentPage = 1;
    // Array per memorizzare le posizioni y dove mettere i footer
    const footerPositions = [];
    
    const addPageHeader = async (pageNum) => {
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
        
        // Solo nella prima pagina mostra tutte le informazioni
        if (pageNum === 1) {
            // Riferimenti aziendali sotto il logo
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('P.I. 01920500228', 20, 48);
            doc.text('via lung\'Adige Luigi Braille, 22', 20, 54);
            doc.text('38121 Trento', 20, 60);
            doc.text('Tel. 3333623616', 20, 66);
            doc.text('stefano.dematte@tiscali.it', 20, 72);
            
            // IBAN sotto la mail
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('IBAN: IT16H0200801820000027285503', 20, 78);
            
            // Titolo a destra in alto
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('FATTURA', 120, 25);
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`N: ${fattura.numero}`, 120, 35);
            doc.text(`Data: ${fattura.data}`, 120, 42);
            
            // Linea di separazione sotto l'IBAN
            doc.line(20, 82, 190, 82);
            
            // Cliente sotto
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE', 20, 92);
            
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Ragione Sociale: ${cliente.ragioneSociale || '-'}`, 20, 99);
            doc.text(`Indirizzo: ${cliente.indirizzo || '-'}`, 20, 106);
            doc.text(`${cliente.citta || ''} (${cliente.provincia || ''}) ${cliente.cap || ''}`, 20, 113);
            doc.text(`Telefono: ${cliente.telefono || '-'}`, 20, 120);
            doc.text(`P.IVA: ${cliente.piva || '-'}`, 20, 127);
            doc.text(`SDI: ${cliente.sdi || '-'}`, 20, 134);
            
            // Linea di separazione
            doc.line(20, 140, 190, 140);
            
            return 148;
        } else {
            // Pagine successive: solo logo, inizia direttamente con articoli
            return 50;
        }
    };
    
    const addPageFooter = (pageNum) => {
        // Memorizza la posizione per aggiornare il footer dopo
        footerPositions.push({ pageNum });
    };
    
    // Prima pagina
    let y = await addPageHeader(currentPage);
    
    // Ordina i DDT inclusi per numero in ordine crescente
    ddtInclusi.sort((a, b) => {
        const numA = parseInt(a.numero) || 0;
        const numB = parseInt(b.numero) || 0;
        return numA - numB;
    });
    
    // Usa le righe della fattura se disponibili, altrimenti quelle dei DDT
    const righeDaUsare = fattura.righe || [];
    
    if (righeDaUsare.length > 0) {
        // Raggruppa le righe per DDT
        for (const ddt of ddtInclusi) {
            // Controlla se serve nuova pagina
            if (y > 230) {
                addPageFooter(currentPage);
                doc.addPage();
                currentPage++;
                y = await addPageHeader(currentPage);
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`DDT ${ddt.numero} - ${ddt.data}`, 20, y);
            y += 12; // Aumentato spazio per evitare sovrapposizione con linea
            
            const righeDDT = righeDaUsare.filter(riga => riga.ddtId === ddt.id);
            
            // Intestazione tabella articoli
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Articolo', 20, y);
            doc.text('Quantità', 100, y);
            doc.text('Prezzo', 130, y);
            doc.text('Totale', 160, y);
            
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.line(20, y - 2, 190, y - 2);
            
            for (const riga of righeDDT) {
                // Controlla se serve nuova pagina per ogni riga
                if (y > 250) {
                    addPageFooter(currentPage);
                    doc.addPage();
                    currentPage++;
                    y = await addPageHeader(currentPage);
                    
                    // Ripeti intestazione tabella
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Articolo', 20, y);
                    doc.text('Quantità', 100, y);
                    doc.text('Prezzo', 130, y);
                    doc.text('Totale', 160, y);
                    
                    y += 8;
                    doc.setFont('helvetica', 'normal');
                    doc.line(20, y - 2, 190, y - 2);
                }
                
                y += 7;
                doc.text(riga.nomeProdotto, 20, y);
                doc.text(`${riga.quantita} ${riga.unitaMisura}`, 100, y);
                doc.text(`€${riga.prezzoUnitario}`, 130, y);
                doc.text(`€${riga.totale}`, 160, y);
            }
            
            y += 10;
            doc.line(20, y - 2, 190, y - 2);
            y += 5;
        }
    } else {
        // Fallback alle righe dei DDT (per fatture vecchie)
        for (const ddt of ddtInclusi) {
            // Controlla se serve nuova pagina
            if (y > 230) {
                addPageFooter(currentPage);
                doc.addPage();
                currentPage++;
                y = await addPageHeader(currentPage);
            }
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`DDT ${ddt.numero} - ${ddt.data}`, 20, y);
            y += 12; // Aumentato spazio per evitare sovrapposizione con linea
            
            // Intestazione tabella articoli
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Articolo', 20, y);
            doc.text('Quantità', 100, y);
            doc.text('Prezzo', 130, y);
            doc.text('Totale', 160, y);
            
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.line(20, y - 2, 190, y - 2);
            
            for (const riga of ddt.righe) {
                // Controlla se serve nuova pagina per ogni riga
                if (y > 250) {
                    addPageFooter(currentPage);
                    doc.addPage();
                    currentPage++;
                    y = await addPageHeader(currentPage);
                    
                    // Ripeti intestazione tabella
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Articolo', 20, y);
                    doc.text('Quantità', 100, y);
                    doc.text('Prezzo', 130, y);
                    doc.text('Totale', 160, y);
                    
                    y += 8;
                    doc.setFont('helvetica', 'normal');
                    doc.line(20, y - 2, 190, y - 2);
                }
                
                y += 7;
                doc.text(riga.nomeProdotto, 20, y);
                doc.text(`${riga.quantita} ${riga.unitaMisura}`, 100, y);
                doc.text(`€${riga.prezzoUnitario}`, 130, y);
                doc.text(`€${riga.totale}`, 160, y);
            }
            
            y += 10;
            doc.line(20, y - 2, 190, y - 2);
            y += 5;
        }
    }
    
    // Controlla se serve nuova pagina per il riepilogo
    if (y > 230) {
        addPageFooter(currentPage);
        doc.addPage();
        currentPage++;
        y = 20;
    }
    
    y += 10;
    doc.line(20, y - 2, 190, y - 2);
    
    // Riepilogo IVA
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Imponibile: €${fattura.totaleImponibile || fattura.totale}`, 120, y + 10);
    doc.text(`IVA (4%): €${fattura.iva || '0.00'}`, 120, y + 17);
    doc.text(`TOTALE: €${fattura.totale}`, 160, y + 24);
    
    // Footer ultima pagina
    addPageFooter(currentPage);
    
    // Aggiorna tutti i footer con il numero totale corretto
    const totalPages = currentPage;
    for (let i = 0; i < totalPages; i++) {
        doc.setPage(i + 1);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`pag. ${i + 1}/${totalPages}`, 105, 285, { align: 'center' });
    }
    
    doc.save(`Fattura_${fattura.numero}_${fattura.data}.pdf`);
}
