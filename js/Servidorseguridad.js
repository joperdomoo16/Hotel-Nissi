// Seguridad del servidor: autenticación de recepción, tokens efímeros, límites de tasa y validación estricta

const Hashpinpredeterminado = '9baed8fceea6e36d36670d72429d909547165efc038c293a14a41ef2edf83141';
const Habitacioneshabilitadas = ['01', '02', '04', '05', '06'];

function Calcularhashservidor(Texto) {
  const Bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(Texto || ''), Utilities.Charset.UTF_8);
  return Bytes.map(function(Valor) {
    const Positivo = Valor < 0 ? Valor + 256 : Valor;
    return Positivo.toString(16).padStart(2, '0');
  }).join('');
}

function Comparartiempoconstante(Textoizq, Textoder) {
  const Izq = String(Textoizq || '');
  const Der = String(Textoder || '');
  let Diferencia = Izq.length ^ Der.length;
  const Limite = Math.max(Izq.length, Der.length);
  for (let Indice = 0; Indice < Limite; Indice++) {
    const Codizq = Indice < Izq.length ? Izq.charCodeAt(Indice) : 0;
    const Codder = Indice < Der.length ? Der.charCodeAt(Indice) : 0;
    Diferencia |= (Codizq ^ Codder);
  }
  return Diferencia === 0 && Izq.length > 0;
}

function Generarcodigoreservaservidor() {
  const Sufijo = Utilities.getUuid().replace(/-/g, '').toUpperCase().slice(0, 6);
  return `NS-${Sufijo}`;
}

function Obtenerhashpinadmin() {
  const Propiedades = PropertiesService.getScriptProperties();
  const Hashguardado = String(Propiedades.getProperty('HASHPINADMIN') || '').trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(Hashguardado)) {
    return Hashguardado;
  }
  const Pinplano = String(Propiedades.getProperty('PINADMIN') || '').trim();
  if (/^\d{4,8}$/.test(Pinplano)) {
    return Calcularhashservidor(Pinplano);
  }
  return Hashpinpredeterminado;
}

function Autenticaradminservidor(Pin) {
  const Cache = CacheService.getScriptCache();
  const Bloqueohasta = Number(Cache.get('ADMIN_BLOQUEO') || 0);
  const Ahorams = Date.now();
  if (Bloqueohasta > Ahorams) {
    const Restantes = Math.ceil((Bloqueohasta - Ahorams) / 1000);
    return {
      exito: false,
      bloqueadosegundos: Restantes,
      mensaje: `Demasiados intentos fallidos. Espera ${Restantes} segundos.`
    };
  }

  const Pinlimpio = String(Pin || '').replace(/\D/g, '').slice(0, 8);
  const Hashesperado = Obtenerhashpinadmin();
  const Hashrecibido = Pinlimpio.length >= 4 ? Calcularhashservidor(Pinlimpio) : '';

  if (Comparartiempoconstante(Hashrecibido, Hashesperado)) {
    Cache.remove('ADMIN_INTENTOS');
    Cache.remove('ADMIN_BLOQUEO');
    const Token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    Cache.put(`ADMIN_TOK_${Token}`, '1', 7200);
    Registrarbitacora('Seguridad', 'AccesoAdmin', 'Sesión administrativa iniciada correctamente.');
    return { exito: true, token: Token, expiraen: 7200 };
  }

  const Intentos = Number(Cache.get('ADMIN_INTENTOS') || 0) + 1;
  Cache.put('ADMIN_INTENTOS', String(Intentos), 300);
  if (Intentos >= 5) {
    const Expiracion = Ahorams + 300000;
    Cache.put('ADMIN_BLOQUEO', String(Expiracion), 300);
    Cache.remove('ADMIN_INTENTOS');
    Registrarbitacora('Seguridad', 'BloqueoAdmin', 'Acceso bloqueado temporalmente tras 5 intentos fallidos.');
    return { exito: false, bloqueadosegundos: 300, mensaje: 'Demasiados intentos fallidos. Acceso bloqueado por 5 minutos.' };
  }

  return { exito: false, mensaje: 'PIN incorrecto. Intenta de nuevo.' };
}

function Validartokenadmin(Token) {
  const Limpio = String(Token || '').trim();
  if (!/^[a-f0-9]{32,96}$/i.test(Limpio)) {
    return false;
  }
  return CacheService.getScriptCache().get(`ADMIN_TOK_${Limpio}`) === '1';
}

function Revocartokenadmin(Token) {
  const Limpio = String(Token || '').trim();
  if (/^[a-f0-9]{32,96}$/i.test(Limpio)) {
    CacheService.getScriptCache().remove(`ADMIN_TOK_${Limpio}`);
  }
  return { exito: true };
}

function Permitirtasapublica(Clave, Maximo, Ventanasegundos) {
  try {
    const Cache = CacheService.getScriptCache();
    const Clavecompleta = `TASA_${String(Clave || 'PUB').replace(/[^A-Z0-9_]/gi, '')}`;
    const Actual = Number(Cache.get(Clavecompleta) || 0);
    if (Actual >= Maximo) {
      return false;
    }
    Cache.put(Clavecompleta, String(Actual + 1), Ventanasegundos || 60);
    return true;
  } catch (Errortasa) {
    return true;
  }
}

function Esfechaisovalida(Texto) {
  const Cadena = String(Texto || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(Cadena)) {
    return false;
  }
  const Partes = Cadena.split('-').map(Number);
  const Fecha = new Date(Date.UTC(Partes[0], Partes[1] - 1, Partes[2]));
  return Fecha.getUTCFullYear() === Partes[0] && (Fecha.getUTCMonth() + 1) === Partes[1] && Fecha.getUTCDate() === Partes[2];
}

function Eshabitacionhabilitada(Numerohab) {
  const Normalizado = String(Numerohab || '').padStart(2, '0');
  return Habitacioneshabilitadas.indexOf(Normalizado) !== -1;
}

function Validarreservaentrada(Datos, Autorizadoadmin) {
  if (!Datos || typeof Datos !== 'object') {
    return { exito: false, mensaje: 'Datos de reserva incompletos.' };
  }
  const Habitacion = String(Datos.habitacion || '').padStart(2, '0');
  if (!Eshabitacionhabilitada(Habitacion)) {
    return { exito: false, mensaje: 'La habitación indicada no está habilitada para reservas.' };
  }
  if (!Esfechaisovalida(Datos.llegada) || !Esfechaisovalida(Datos.salida)) {
    return { exito: false, mensaje: 'Las fechas de llegada y salida deben tener un formato válido.' };
  }
  const Noches = Math.round((new Date(Datos.salida) - new Date(Datos.llegada)) / 86400000);
  if (Noches < 1 || Noches > 60) {
    return { exito: false, mensaje: 'El rango de fechas debe estar entre 1 y 60 noches.' };
  }
  const Huespedes = parseInt(Datos.huespedes, 10);
  if (isNaN(Huespedes) || Huespedes < 1 || Huespedes > 3) {
    return { exito: false, mensaje: 'La cantidad de huéspedes permitida es de 1 a 3 personas.' };
  }
  const Nombre = Sanitizarcelda(Datos.nombre, 80);
  const Celular = String(Datos.celular || '').replace(/\D/g, '');
  const Cedula = String(Datos.cedula || '').replace(/\D/g, '');
  if (!Nombre) {
    return { exito: false, mensaje: 'El nombre del huésped es obligatorio.' };
  }
  if (Celular.length < 7 || Celular.length > 13) {
    return { exito: false, mensaje: 'Ingresa un número de celular válido.' };
  }
  if (Cedula && !/^[1-9]\d{5,9}$/.test(Cedula)) {
    return { exito: false, mensaje: 'Ingresa una cédula colombiana válida (6 a 10 dígitos).' };
  }
  if (!Autorizadoadmin && !Cedula) {
    return { exito: false, mensaje: 'La cédula de ciudadanía es obligatoria.' };
  }

  const Montopagado = Number(Datos.montopagado || 0);
  const Montonequi = Number(Datos.montonequi || 0);
  const Montoefectivo = Number(Datos.montoefectivo || 0);
  if (!isFinite(Montopagado) || Montopagado < 0 || Montopagado > 50000000 ||
      !isFinite(Montonequi) || Montonequi < 0 || !isFinite(Montoefectivo) || Montoefectivo < 0) {
    return { exito: false, mensaje: 'Los valores de pago no son válidos.' };
  }

  return {
    exito: true,
    datos: {
      codigo: Sanitizarcelda(Datos.codigo || '', 20),
      nombre: Nombre,
      cedula: Cedula,
      celular: Celular,
      habitacion: Habitacion,
      llegada: String(Datos.llegada).trim(),
      salida: String(Datos.salida).trim(),
      huespedes: Huespedes,
      camasseparadas: Boolean(Datos.camasseparadas),
      horallegada: Sanitizarcelda(Datos.horallegada || 'Por confirmar', 40),
      montopagado: Montopagado,
      montonequi: Montonequi,
      montoefectivo: Montoefectivo,
      referenciapago: Sanitizarcelda(Datos.referenciapago || '', 80),
      entidadpago: Sanitizarcelda(Datos.entidadpago || 'Efectivo', 30),
      estado: Autorizadoadmin && Datos.estado === 'Confirmada' ? 'Confirmada' : 'Apartada'
    }
  };
}

function Esurlmediameta(Url) {
  const Cadena = String(Url || '').trim();
  const Coincidencia = Cadena.match(/^https:\/\/([a-z0-9.-]+)(?:\/|$)/i);
  if (!Coincidencia) {
    return false;
  }
  const Host = Coincidencia[1].toLowerCase();
  return Host === 'lookaside.fbsbx.com' ||
         Host === 'graph.facebook.com' ||
         Host.endsWith('.fbcdn.net') ||
         Host.endsWith('.whatsapp.net');
}

function Validarllavewebhook(Eventopeticion, Credenciales) {
  const Esperada = String((Credenciales && Credenciales.llavewebhook) || '').trim();
  if (!Esperada) {
    return false;
  }
  const Recibida = String((Eventopeticion && Eventopeticion.parameter && Eventopeticion.parameter.llave) || '').trim();
  return Comparartiempoconstante(Recibida, Esperada);
}

function Validaridtelefonowhatsapp(Valor, Credenciales) {
  const Idesperado = String((Credenciales && Credenciales.idtelefonowhatsapp) || '').trim();
  if (!Idesperado) {
    return true;
  }
  const Idrecibido = String((Valor && Valor.metadata && Valor.metadata.phone_number_id) || '').trim();
  if (!Comparartiempoconstante(Idrecibido, Idesperado)) {
    Registrarbitacora('Seguridad', 'PhoneIdRechazado', 'Identificador de teléfono no coincide con la línea oficial.');
    return false;
  }
  return true;
}
