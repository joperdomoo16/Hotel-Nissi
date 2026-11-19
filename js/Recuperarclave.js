// Pantalla para definir una nueva contraseña desde el enlace enviado al correo

document.addEventListener('DOMContentLoaded', function() {
  const Parametros = new URLSearchParams(window.location.search);
  const Modo = Parametros.get('mode');
  const Codigo = Parametros.get('oobCode');

  const Formulario = document.getElementById('claveForm');
  const Campoclave = document.getElementById('claveNueva');
  const Campoconfirmar = document.getElementById('claveConfirmar');
  const Botonguardar = document.getElementById('claveGuardar');
  const Textoerror = document.getElementById('claveError');
  const Textomotivo = document.getElementById('claveMotivo');
  const Enlacewhatsapp = document.getElementById('claveWhatsapp');

  // El codigo de seguridad no debe quedar en el historial del navegador
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  if (Enlacewhatsapp && typeof Configuracionhotel !== 'undefined') {
    const Digitos = String(Configuracionhotel.celular || '').replace(/\D/g, '');
    Enlacewhatsapp.href = `https://wa.me/${Digitos}?text=${encodeURIComponent('Hola Hospedaje Nissi, necesito ayuda para cambiar mi contraseña.')}`;
  }

  function Mostrarestado(Estado) {
    document.querySelectorAll('[data-estado]').forEach(function(Bloque) {
      Bloque.hidden = Bloque.dataset.estado !== Estado;
    });
  }

  function Mostrarerrorenlace(Codigoerror) {
    if (Textomotivo) {
      Textomotivo.textContent = Codigoerror === 'auth/user-disabled'
        ? 'Esta cuenta está deshabilitada. Escríbenos por WhatsApp para ayudarte.'
        : 'Los enlaces para cambiar la contraseña vencen en 1 hora y solo se pueden usar una vez. Pide uno nuevo desde «¿Olvidaste tu contraseña?».';
    }
    Mostrarestado('error');
  }

  function Traducirerrorclave(Codigoerror) {
    switch (Codigoerror) {
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      case 'auth/network-request-failed':
        return 'Error de conexión. Revisa el internet y vuelve a intentarlo.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos.';
      default:
        return 'No pudimos guardar la contraseña. Intenta de nuevo.';
    }
  }

  if (Modo !== 'resetPassword' || !Codigo || typeof firebase === 'undefined' || !firebase.apps.length) {
    Mostrarerrorenlace('');
    return;
  }

  const Autenticacion = firebase.auth();

  // Paso 1: comprobar que el enlace sigue vigente y mostrar el correo de la cuenta
  Autenticacion.verifyPasswordResetCode(Codigo)
    .then(function(Correo) {
      document.getElementById('claveCorreo').textContent = Correo;
      Mostrarestado('formulario');
      Campoclave.focus();
    })
    .catch(function(Errorenlace) {
      Mostrarerrorenlace(Errorenlace && Errorenlace.code);
    });

  // Mostrar u ocultar la contraseña escrita
  document.querySelectorAll('[data-ver]').forEach(function(Boton) {
    Boton.addEventListener('click', function() {
      const Campo = document.getElementById(Boton.dataset.ver);
      const Visible = Campo.type === 'text';
      Campo.type = Visible ? 'password' : 'text';
      Boton.textContent = Visible ? 'Ver' : 'Ocultar';
      Boton.setAttribute('aria-label', Visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
  });

  [Campoclave, Campoconfirmar].forEach(function(Campo) {
    Campo.addEventListener('input', function() {
      Textoerror.textContent = '';
    });
  });

  // Paso 2: guardar la nueva contraseña
  Formulario.addEventListener('submit', function(Evento) {
    Evento.preventDefault();
    const Clave = Campoclave.value;

    if (Clave.length < 6) {
      Textoerror.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      return Campoclave.focus();
    }
    if (Clave !== Campoconfirmar.value) {
      Textoerror.textContent = 'Las dos contraseñas no coinciden.';
      return Campoconfirmar.focus();
    }

    Botonguardar.disabled = true;
    Botonguardar.textContent = 'Guardando...';

    Autenticacion.confirmPasswordReset(Codigo, Clave)
      .then(function() {
        Formulario.reset();
        Mostrarestado('listo');
      })
      .catch(function(Errorguardar) {
        const Codigoerror = (Errorguardar && Errorguardar.code) || '';
        if (Codigoerror === 'auth/expired-action-code' || Codigoerror === 'auth/invalid-action-code' || Codigoerror === 'auth/user-disabled') {
          return Mostrarerrorenlace(Codigoerror);
        }
        Textoerror.textContent = Traducirerrorclave(Codigoerror);
      })
      .finally(function() {
        Botonguardar.disabled = false;
        Botonguardar.textContent = 'Guardar contraseña ';
        const Flecha = document.createElement('span');
        Flecha.setAttribute('aria-hidden', 'true');
        Flecha.textContent = '→';
        Botonguardar.appendChild(Flecha);
      });
  });
});
