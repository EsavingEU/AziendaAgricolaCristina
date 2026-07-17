// Clienti Management
let clienti = [];
let editingCliente = null;

// DOM Elements
const clientiTableBody = document.getElementById('clienti-table-body');
const addClienteBtn = document.getElementById('add-cliente-btn');
const clienteModal = document.getElementById('cliente-modal');
const clienteForm = document.getElementById('cliente-form');
const clienteModalTitle = document.getElementById('cliente-modal-title');

// Check authentication
firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'index.html';
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadClienti();
    setupEventListeners();
});

function setupEventListeners() {
    addClienteBtn.addEventListener('click', () => openClienteModal());
    clienteForm.addEventListener('submit', handleClienteSubmit);
}

async function loadClienti() {
    try {
        const snapshot = await db.collection('clienti').get();
        clienti = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderClienti();
    } catch (error) {
        console.error('Errore caricamento clienti:', error);
        clientiTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Errore caricamento dati</td></tr>';
    }
}

function renderClienti() {
    if (clienti.length === 0) {
        clientiTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nessun cliente presente</td></tr>';
        return;
    }

    clientiTableBody.innerHTML = clienti.map(cliente => `
        <tr>
            <td>${cliente.ragioneSociale || '-'}</td>
            <td>${cliente.citta} (${cliente.provincia})</td>
            <td>${cliente.telefono}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editCliente('${cliente.id}')">Modifica</button>
                <button class="action-btn delete-btn" onclick="deleteCliente('${cliente.id}')">Elimina</button>
            </td>
        </tr>
    `).join('');
}

function openClienteModal(cliente = null) {
    editingCliente = cliente;
    clienteModalTitle.textContent = cliente ? 'Modifica Cliente' : 'Nuovo Cliente';
    
    if (cliente) {
        document.getElementById('cliente-ragione-sociale').value = cliente.ragioneSociale || '';
        document.getElementById('cliente-indirizzo').value = cliente.indirizzo || '';
        document.getElementById('cliente-citta').value = cliente.citta || '';
        document.getElementById('cliente-cap').value = cliente.cap || '';
        document.getElementById('cliente-provincia').value = cliente.provincia || '';
        document.getElementById('cliente-telefono').value = cliente.telefono || '';
        document.getElementById('cliente-email').value = cliente.email || '';
        document.getElementById('cliente-piva').value = cliente.piva || '';
        document.getElementById('cliente-cf').value = cliente.codiceFiscale || '';
        document.getElementById('cliente-sdi').value = cliente.sdi || '';
    } else {
        clienteForm.reset();
    }
    
    clienteModal.classList.add('active');
}

function closeClienteModal() {
    clienteModal.classList.remove('active');
    editingCliente = null;
    clienteForm.reset();
}

async function handleClienteSubmit(e) {
    e.preventDefault();
    
    const clienteData = {
        ragioneSociale: document.getElementById('cliente-ragione-sociale').value,
        indirizzo: document.getElementById('cliente-indirizzo').value,
        citta: document.getElementById('cliente-citta').value,
        cap: document.getElementById('cliente-cap').value,
        provincia: document.getElementById('cliente-provincia').value,
        telefono: document.getElementById('cliente-telefono').value,
        email: document.getElementById('cliente-email').value,
        piva: document.getElementById('cliente-piva').value,
        codiceFiscale: document.getElementById('cliente-cf').value,
        sdi: document.getElementById('cliente-sdi').value
    };

    try {
        if (editingCliente) {
            await db.collection('clienti').doc(editingCliente.id).update(clienteData);
        } else {
            await db.collection('clienti').add(clienteData);
        }
        
        closeClienteModal();
        loadClienti();
    } catch (error) {
        console.error('Errore salvataggio cliente:', error);
        alert('Errore salvataggio cliente');
    }
}

async function deleteCliente(id) {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) return;
    
    try {
        await db.collection('clienti').doc(id).delete();
        loadClienti();
    } catch (error) {
        console.error('Errore eliminazione cliente:', error);
        alert('Errore eliminazione cliente');
    }
}

function editCliente(id) {
    const cliente = clienti.find(c => c.id === id);
    if (cliente) {
        openClienteModal(cliente);
    }
}
