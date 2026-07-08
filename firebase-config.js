// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCWgT_T8hPvP3_S80FDxlo2NyE3OMFseaM",
    authDomain: "azienda-agricola-cristina.firebaseapp.com",
    projectId: "azienda-agricola-cristina",
    storageBucket: "azienda-agricola-cristina.firebasestorage.app",
    messagingSenderId: "394996803820",
    appId: "1:394996803820:web:396983941c9cdae849ddc9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
