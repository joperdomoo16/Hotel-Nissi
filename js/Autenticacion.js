// Autenticación de viajeros con Firebase y envío de correos transaccionales

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
    return Promise.reject({ code: 'auth/network-request-failed' });
  }

  return firebase.auth().createUserWithEmailAndPassword(Correo, Clave)
    .then(function(Credencialusuario) {
      return Credencialusuario.user.updateProfile({
        displayName: Nombre
      }).then(function() {
        Solicitarcorreobienvenida(Credencialusuario.user);
        return Credencialusuario.user;
      });
    });
}

function Solicitarcorreobienvenida(Usuario) {
  if (!Usuario || typeof Usuario.getIdToken !== 'function' || !Configuracionhotel.urlservidor) {
    return Promise.resolve(null);
  }
  return Usuario.getIdToken()
    .then(function(Tokensesion) {
      return fetch(Configuracionhotel.urlservidor, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'bienvenida', token: Tokensesion })
      });
    })
    .then(function(Respuesta) {
      return Respuesta.json();
    })
    .catch(function() {
      return null;
    });
}

function Esusuarionuevo(Resultadoacceso) {
  return Boolean(
    Resultadoacceso &&
    Resultadoacceso.user &&
    Resultadoacceso.additionalUserInfo &&
    Resultadoacceso.additionalUserInfo.isNewUser
  );
}

function Solicitarrecuperacionclave(Correo) {
  if (!Firebaseactivo()) {
    return Promise.reject({ code: 'auth/network-request-failed' });
  }

  if (Configuracionhotel.recuperacionporservidor && Configuracionhotel.urlservidor) {
    return fetch(Configuracionhotel.urlservidor, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ accion: 'recuperarclave', correo: Correo })
    })
      .then(function(Respuesta) {
        return Respuesta.json();
      })
      .then(function(Datos) {
        if (Datos && Datos.exito === false) {
          throw { code: 'auth/invalid-email' };
        }
      });
  }

  const Ajustesenlace = { url: Configuracionhotel.urlsitio, handleCodeInApp: false };
  return firebase.auth().sendPasswordResetEmail(Correo, Ajustesenlace)
    .catch(function(Errorenvio) {
      if (Errorenvio && (Errorenvio.code === 'auth/unauthorized-continue-uri' || Errorenvio.code === 'auth/invalid-continue-uri')) {
        return firebase.auth().sendPasswordResetEmail(Correo);
      }
      throw Errorenvio;
    });
}

function Iniciarsesionusuario(Correo, Clave) {
  if (!Firebaseactivo()) {
    return Promise.reject({ code: 'auth/network-request-failed' });
  }
  return firebase.auth().signInWithEmailAndPassword(Correo, Clave);
}

function Autenticarcongoogle() {
  if (!Firebaseactivo()) {
    return Promise.reject({ code: 'auth/network-request-failed' });
  }

  const Proveedor = new firebase.auth.GoogleAuthProvider();
  Proveedor.setCustomParameters({ prompt: 'select_account' });
  return firebase.auth().signInWithPopup(Proveedor)
    .then(function(Resultadoacceso) {
      if (Esusuarionuevo(Resultadoacceso)) {
        Solicitarcorreobienvenida(Resultadoacceso.user);
      }
      return Resultadoacceso;
    })
    .catch(function(Errorpopup) {
      if (Errorpopup && (Errorpopup.code === 'auth/popup-blocked' || Errorpopup.code === 'auth/operation-not-supported-in-this-environment')) {
        return firebase.auth().signInWithRedirect(Proveedor);
      }
      throw Errorpopup;
    });
}

function Verificarresultadoredireccion(Retornoerror) {
  if (!Firebaseactivo()) {
    return;
  }
  firebase.auth().getRedirectResult().then(function(Resultadoacceso) {
    if (Esusuarionuevo(Resultadoacceso)) {
      Solicitarcorreobienvenida(Resultadoacceso.user);
    }
  }).catch(function(Errorredireccion) {
    if (Errorredireccion && typeof Retornoerror === 'function') {
      Retornoerror(Traducirerrorfirebase(Errorredireccion.code || ''));
    }
  });
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
      return 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Revisa el internet de tu computador o celular.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio.';
    case 'auth/cancelled-popup-request':
      return 'Se canceló la solicitud de acceso con Google.';
    case 'auth/operation-not-allowed':
      return 'El acceso con Google no está disponible en este momento.';
    case 'auth/unauthorized-domain':
      return 'Este sitio no pudo validar el acceso externo. Intenta con correo y contraseña.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta registrada con ese correo usando otro método de acceso.';
    case 'auth/missing-email':
      return 'Escribe tu correo para enviarte el enlace de recuperación.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
      return 'No pudimos preparar el enlace de recuperación. Escríbenos por WhatsApp.';
    default:
      return 'No fue posible completar la solicitud. Intenta de nuevo.';
  }
}

Inicializarfirebase();
