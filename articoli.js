// Articoli Management
let articoli = [];
let editingArticolo = null;

// DOM Elements
const articoliTableBody = document.getElementById('articoli-table-body');
const addArticoloBtn = document.getElementById('add-articolo-btn');
const articoloModal = document.getElementById('articolo-modal');
const articoloForm = document.getElementById('articolo-form');
const articoloModalTitle = document.getElementById('articolo-modal-title');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadArticoli();
    setupEventListeners();
});

function setupEventListeners() {
    addArticoloBtn.addEventListener('click', () => openArticoloModal());
    articoloForm.addEventListener('submit', handleArticoloSubmit);
}

async function loadArticoli() {
    try {
        const snapshot = await db.collection('prodotti').get();
        articoli = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderArticoli();
    } catch (error) {
        console.error('Errore caricamento articoli:', error);
        articoliTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Errore caricamento dati</td></tr>';
    }
}

function renderArticoli() {
    if (articoli.length === 0) {
        articoliTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nessun articolo presente</td></tr>';
        return;
    }

    articoliTableBody.innerHTML = articoli.map(articolo => `
        <tr>
            <td>${articolo.nome}</td>
            <td>${articolo.descrizione}</td>
            <td>${articolo.unitaMisura}</td>
            <td>€${articolo.prezzoUnitario}</td>
            <td>${articolo.categoria}</td>
            <td>
                <button class="action-btn edit-btn" onclick="editArticolo('${articolo.id}')">Modifica</button>
                <button class="action-btn delete-btn" onclick="deleteArticolo('${articolo.id}')">Elimina</button>
            </td>
        </tr>
    `).join('');
}

function openArticoloModal(articolo = null) {
    editingArticolo = articolo;
    articoloModalTitle.textContent = articolo ? 'Modifica Articolo' : 'Nuovo Articolo';
    
    if (articolo) {
        document.getElementById('articolo-nome').value = articolo.nome;
        document.getElementById('articolo-descrizione').value = articolo.descrizione;
        document.getElementById('articolo-unita').value = articolo.unitaMisura;
        document.getElementById('articolo-prezzo').value = articolo.prezzoUnitario;
        document.getElementById('articolo-categoria').value = articolo.categoria;
    } else {
        articoloForm.reset();
    }
    
    articoloModal.classList.add('active');
}

function closeArticoloModal() {
    articoloModal.classList.remove('active');
    editingArticolo = null;
    articoloForm.reset();
}

async function handleArticoloSubmit(e) {
    e.preventDefault();
    
    const articoloData = {
        nome: document.getElementById('articolo-nome').value,
        descrizione: document.getElementById('articolo-descrizione').value,
        unitaMisura: document.getElementById('articolo-unita').value,
        prezzoUnitario: parseFloat(document.getElementById('articolo-prezzo').value) || 0,
        categoria: document.getElementById('articolo-categoria').value
    };

    try {
        if (editingArticolo) {
            await db.collection('prodotti').doc(editingArticolo.id).update(articoloData);
        } else {
            await db.collection('prodotti').add(articoloData);
        }
        
        closeArticoloModal();
        loadArticoli();
    } catch (error) {
        console.error('Errore salvataggio articolo:', error);
        alert('Errore salvataggio articolo');
    }
}

async function deleteArticolo(id) {
    if (!confirm('Sei sicuro di voler eliminare questo articolo?')) return;
    
    try {
        await db.collection('prodotti').doc(id).delete();
        loadArticoli();
    } catch (error) {
        console.error('Errore eliminazione articolo:', error);
        alert('Errore eliminazione articolo');
    }
}

function editArticolo(id) {
    const articolo = articoli.find(a => a.id === id);
    if (articolo) {
        openArticoloModal(articolo);
    }
}
