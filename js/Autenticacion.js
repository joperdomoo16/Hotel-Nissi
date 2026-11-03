// Modulo de gestion y autenticacion de usuarios con Firebase

const Configuracionfirebase = {
  apiKey: "AIzaSyDejKbwGSI3t4_gw6YRXeDwEDnhBIKjI0o",
  authDomain: "hotel-nissi-mingueo.firebaseapp.com",
  projectId: "hotel-nissi-mingueo",
  storageBucket: "hotel-nissi-mingueo.firebasestorage.app",
  messagingSenderId: "828441790622",
  appId: "1:828441790622:web:57c5a34014f5541376d38f"
};

function Firebaseactivo() {
  return typeof firebase !== 'undefined' && 
         Boolean(firebase.apps) && 
         Boolean(firebase.apps.length);
}

function Inicializarfirebase() {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(Configuracionfirebase);
  }
}

function Registrarnuevousuario(Nombre, Correo, Clave) {
  if (!Firebaseactivo()) {
    // Modo local de respaldo cuando aun no se han colocado credenciales
    return Promise.resolve({
      displayName: Nombre,
      email: Correo
    });
  }

  return firebase.auth().createUserWithEmailAndPassword(Correo, Clave)
    .then(function(Credencialusuario) {
      return Credencialusuario.user.updateProfile({
        displayName: Nombre
      }).then(function() {
        return Credencialusuario.user;
      });
    });
}

function Iniciarsesionusuario(Correo, Clave) {
  if (!Firebaseactivo()) {
    // Modo local de respaldo cuando aun no se han colocado credenciales
    return Promise.resolve({
      user: {
        displayName: Correo.split('@')[0],
        email: Correo
      }
    });
  }

  return firebase.auth().signInWithEmailAndPassword(Correo, Clave);
}

function Cerrarsesionusuario() {
  if (!Firebaseactivo()) {
    return Promise.resolve();
  }
  return firebase.auth().signOut();
}

function Observadorestadoautenticacion(Retornoestado) {
  if (Firebaseactivo()) {
    firebase.auth().onAuthStateChanged(Retornoestado);
  }
}

function Traducirerrorfirebase(Codigoerror) {
  switch (Codigoerror) {
    case 'auth/email-already-in-use':
      return 'Este correo ya tiene una cuenta registrada.';
    case 'auth/invalid-email':
      return 'El correo escrito no tiene un formato válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Intenta más tarde.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Revisa el internet de tu computador o celular.';
    default:
      return 'No fue posible completar la solicitud. Intenta de nuevo.';
  }
}

// Inicializar la aplicacion de Firebase al cargar el script
Inicializarfirebase();

