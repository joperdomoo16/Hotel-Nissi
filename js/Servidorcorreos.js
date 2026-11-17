// Servidor de correos en Google Apps Script para Hospedaje Nissi: bienvenida, informe diario y recuperacion de contraseña
// Las plantillas viven como archivos HTML dentro del proyecto de Apps Script: Correobienvenida, Informediario y Correorecuperacion

const Datoscorreo = {
  remitente: 'Hospedaje Nissi',
  urlsitio: 'https://hospedaje-nissi-mingueo.web.app',
  // Enlace completo (no acortado): los filtros de spam penalizan los enlaces acortados
  urlmaps: 'https://www.google.com/maps/dir/?api=1&destination=11.216310,-73.392264',
  urlwaze: 'https://waze.com/ul?ll=11.216310,-73.392264&navigate=yes',
  whatsapp: '573001234567',
  proyectofirebase: 'hotel-nissi-mingueo',
  zonahoraria: 'America/Bogota',
  diasvalidezbienvenida: 2,
  reservacuotacorreo: 5
};

const Diassemanacorreo = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const Mesescorreo = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const Fuentesans = "'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const Fuenteserif = "'Newsreader',Georgia,'Times New Roman',serif";

// Utilidades de plantillas

// Lee el HTML crudo de un archivo del proyecto de Apps Script
function Cargarplantilla(Nombrearchivo) {
  return HtmlService.createTemplateFromFile(Nombrearchivo).getRawContent();
}

// Reemplaza {{CLAVE}} con texto escapado y los bloques <!--INICIO:X--> ... <!--FIN:X--> con HTML generado
function Rellenarplantilla(Html, Valores, Bloques) {
  let Resultado = Html.replace(/\{\{([A-Z]+)\}\}/g, function(Coincidencia, Clave) {
    return Object.prototype.hasOwnProperty.call(Valores, Clave)
      ? Escaparhtmlservidor(Valores[Clave])
      : Coincidencia;
  });

  Object.keys(Bloques || {}).forEach(function(Clave) {
    const Patron = new RegExp('<!--INICIO:' + Clave + '-->[\\s\\S]*?<!--FIN:' + Clave + '-->');
    if (!Patron.test(Resultado)) {
      throw new Error('La plantilla no tiene el bloque ' + Clave + '. Pega de nuevo el HTML completo.');
    }
    Resultado = Resultado.replace(Patron, function() {
      return Bloques[Clave];
    });
  });

  return Resultado;
}

function Formatearpesos(Valor) {
  const Numero = Math.round(Number(Valor) || 0);
  return String(Numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Convierte una celda (Date o texto) al formato yyyy-MM-dd en hora de Colombia
function Normalizarfecha(Valor) {
  if (Valor instanceof Date && !isNaN(Valor.getTime())) {
    return Utilities.formatDate(Valor, Datoscorreo.zonahoraria, 'yyyy-MM-dd');
  }
  const Texto = String(Valor == null ? '' : Valor).trim();
  const Coincidencia = Texto.match(/^\d{4}-\d{2}-\d{2}/);
  if (Coincidencia) {
    return Coincidencia[0];
  }
  const Fecha = new Date(Texto);
  return isNaN(Fecha.getTime()) ? '' : Utilities.formatDate(Fecha, Datoscorreo.zonahoraria, 'yyyy-MM-dd');
}

// Sheets convierte "22:00" en una fecha de 1899; se formatea con la zona horaria del libro
function Formatearhora(Valor, Zonalibro) {
  if (Valor instanceof Date) {
    return isNaN(Valor.getTime())
      ? 'Por confirmar'
      : Utilities.formatDate(Valor, Zonalibro || Datoscorreo.zonahoraria, 'HH:mm');
  }
  return String(Valor || '').trim() || 'Por confirmar';
}

function Primernombre(Nombrecompleto) {
  return String(Nombrecompleto || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .trim()
    .split(/\s+/)[0]
    .slice(0, 40);
}

function Construirenlacewhatsappservidor(Mensaje) {
  return `https://wa.me/${Datoscorreo.whatsapp}?text=${encodeURIComponent(Mensaje)}`;
}

// Correo para las funciones de prueba: propiedad CORREOPRUEBA o, si no existe, CORREOADMIN
function Obtenercorreoprueba() {
  const Correoprueba = PropertiesService.getScriptProperties().getProperty('CORREOPRUEBA');
  return (Correoprueba && Correoprueba.trim()) || Obtenercredenciales().correoadmin;
}

function Respuestajsonservidor(Objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(Objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

// Registro de usuarios de la web

function Obtenerhojausuarios() {
  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  let Hoja = Libro.getSheetByName('Usuarios');
  if (!Hoja) {
    Hoja = Libro.insertSheet('Usuarios');
    Hoja.appendRow(['Uid', 'Nombre', 'Correo', 'Proveedor', 'Fecharegistro', 'Bienvenida']);
  }
  return Hoja;
}

function Buscarusuarioregistrado(Hoja, Uid) {
  const Ultimafila = Hoja.getLastRow();
  if (Ultimafila < 2) {
    return false;
  }
  const Uids = Hoja.getRange(2, 1, Ultimafila - 1, 1).getValues();
  return Uids.some(function(Fila) {
    return String(Fila[0]) === Uid;
  });
}

// Valida el token de sesion de Firebase contra Google y devuelve los datos reales del usuario
function Verificartokenfirebase(Token) {
  const Credenciales = Obtenercredenciales();
  const Respuesta = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(Credenciales.clavefirebase),
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({ idToken: String(Token).slice(0, 4096) })
    }
  );

  if (Respuesta.getResponseCode() !== 200) {
    console.warn('Token de Firebase rechazado: ' + Respuesta.getContentText().slice(0, 300));
    return null;
  }

  const Datos = JSON.parse(Respuesta.getContentText());
  const Usuario = Datos.users && Datos.users[0];
  if (!Usuario || !Usuario.email) {
    return null;
  }

  const Proveedores = (Usuario.providerUserInfo || []).map(function(Proveedor) {
    return Proveedor.providerId;
  });

  return {
    uid: String(Usuario.localId),
    correo: String(Usuario.email),
    nombre: String(Usuario.displayName || ''),
    creado: Number(Usuario.createdAt || 0),
    proveedor: Proveedores.indexOf('google.com') !== -1 ? 'Google' : 'Correo y contraseña'
  };
}

// Correo de bienvenida

// Punto de entrada desde la web: se envia una sola vez por cuenta y solo en su primer ingreso
function Procesarcorreobienvenida(Token) {
  if (!Token) {
    return { exito: false, mensaje: 'Falta la sesión del usuario.' };
  }

  const Usuario = Verificartokenfirebase(Token);
  if (!Usuario) {
    return { exito: false, mensaje: 'Sesión no válida.' };
  }

  const Edadcuenta = Date.now() - Usuario.creado;
  if (!Usuario.creado || Edadcuenta > Datoscorreo.diasvalidezbienvenida * 86400000) {
    return { exito: false, mensaje: 'La bienvenida solo se envía en el primer ingreso.' };
  }

  const Candado = LockService.getScriptLock();
  if (!Candado.tryLock(15000)) {
    return { exito: false, mensaje: 'Servidor ocupado, intenta de nuevo.' };
  }

  try {
    const Hoja = Obtenerhojausuarios();
    if (Buscarusuarioregistrado(Hoja, Usuario.uid)) {
      return { exito: true, yaenviado: true };
    }

    let Estadoenvio = 'Enviada';
    if (MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) {
      Estadoenvio = 'No enviada: cuota diaria agotada';
    } else {
      Enviarcorreobienvenida(Usuario);
    }

    Hoja.appendRow([
      Sanitizarcelda(Usuario.uid, 64),
      Sanitizarcelda(Usuario.nombre, 80),
      Sanitizarcelda(Usuario.correo, 120),
      Usuario.proveedor,
      Utilities.formatDate(new Date(), Datoscorreo.zonahoraria, 'yyyy-MM-dd HH:mm'),
      Estadoenvio
    ]);

    return { exito: Estadoenvio === 'Enviada', mensaje: Estadoenvio };
  } finally {
    Candado.releaseLock();
  }
}

function Enviarcorreobienvenida(Usuario) {
  const Credenciales = Obtenercredenciales();
  const Nombre = Primernombre(Usuario.nombre) || Primernombre(Usuario.correo.split('@')[0]) || 'viajero';
  const Enlacewhatsapp = Construirenlacewhatsappservidor('Hola Hospedaje Nissi, quiero reservar una habitación.');

  const Html = Rellenarplantilla(
    Cargarplantilla('Correobienvenida'),
    {
      NOMBRE: Nombre,
      CORREO: Usuario.correo,
      URLSITIO: Datoscorreo.urlsitio,
      URLMAPS: Datoscorreo.urlmaps,
      URLWAZE: Datoscorreo.urlwaze,
      URLWHATSAPP: Enlacewhatsapp,
      ANIO: Utilities.formatDate(new Date(), Datoscorreo.zonahoraria, 'yyyy')
    },
    {}
  );

  const Textoplano =
    `Hola, ${Nombre}.\n\n` +
    `Gracias por crear tu cuenta en Hospedaje Nissi. Te mantendremos informado de la disponibilidad de nuestras habitaciones para que decidas más rápido.\n\n` +
    `Guarda este correo como favorito: aquí tienes la ruta para llegar rápidamente.\n` +
    `Google Maps: ${Datoscorreo.urlmaps}\n` +
    `Waze: ${Datoscorreo.urlwaze}\n\n` +
    `También puedes reservar por WhatsApp: ${Enlacewhatsapp}\n\n` +
    `Hospedaje Nissi · Troncal del Caribe, Mingueo, Dibulla, La Guajira`;

  MailApp.sendEmail({
    to: Usuario.correo,
    subject: `${Nombre}, tu cuenta en Hospedaje Nissi está lista`,
    htmlBody: Html,
    body: Textoplano,
    name: Datoscorreo.remitente,
    replyTo: Credenciales.correoadmin
  });
}

// Ejecuta esta funcion desde el editor para recibir una muestra de la bienvenida en el correo de prueba
function Probarcorreobienvenida() {
  const Correoprueba = Obtenercorreoprueba();
  Enviarcorreobienvenida({
    correo: Correoprueba,
    nombre: 'Viajero de prueba'
  });
  console.log('Bienvenida de prueba enviada a ' + Correoprueba);
}

// Informe diario de ventas

// Reloj automatico diario: envia el informe al correo del administrador
function Enviarinformecorreodiario() {
  if (typeof Liberarhabitacionesvencidas === 'function') {
    Liberarhabitacionesvencidas();
  }

  const Credenciales = Obtenercredenciales();
  if (!Credenciales.correoadmin) {
    return;
  }

  const Libro = SpreadsheetApp.getActiveSpreadsheet();
  const Zonalibro = Libro.getSpreadsheetTimeZone();
  const Hojahabitaciones = Libro.getSheetByName('Habitaciones');
  const Hojareservas = Libro.getSheetByName('Reservas');
  const Hojausuarios = Libro.getSheetByName('Usuarios');

  const Ahora = new Date();
  const Hoy = Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'yyyy-MM-dd');
  const Filashab = Hojahabitaciones.getDataRange().getValues().slice(1);
  const Filasres = Hojareservas.getDataRange().getValues().slice(1);

  let Recaudo = 0;
  let Confirmadas = 0;
  let Pendientes = 0;
  const Llegadas = [];
  const Salidas = [];

  Filasres.forEach(function(Fila) {
    const Fecharegistro = Normalizarfecha(Fila[1]);
    const Llegada = Normalizarfecha(Fila[5]);
    const Salida = Normalizarfecha(Fila[6]);
    const Estado = String(Fila[14]);
    const Pagado = Number(Fila[11] || 0);
    const Valida = Estado === 'Confirmada' || Estado === 'Finalizada';

    if (Fecharegistro === Hoy && Valida) {
      Recaudo += Pagado;
      Confirmadas++;
    }
    if (Estado === 'Pendiente' && (!Llegada || Llegada >= Hoy)) {
      Pendientes++;
    }
    if (Llegada === Hoy && Estado === 'Confirmada') {
      Llegadas.push(Fila);
    }
    if (Salida === Hoy && Valida) {
      Salidas.push(Fila);
    }
  });

  let Nuevosusuarios = 0;
  if (Hojausuarios && Hojausuarios.getLastRow() > 1) {
    Hojausuarios.getRange(2, 5, Hojausuarios.getLastRow() - 1, 1).getValues().forEach(function(Fila) {
      if (Normalizarfecha(Fila[0]) === Hoy) {
        Nuevosusuarios++;
      }
    });
  }

  const Totalhab = Filashab.length;
  const Ocupadas = Filashab.filter(function(Hab) {
    return String(Hab[5]) === 'Ocupada';
  }).length;
  const Porcentaje = Totalhab ? Math.round((Ocupadas / Totalhab) * 100) : 0;

  const Diasemana = Diassemanacorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'u')) - 1];
  const Fechacorta = `${Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'd')} de ${Mesescorreo[Number(Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'M')) - 1]}`;

  const Textoconfirmadas = Confirmadas === 0
    ? 'Aún no hay reservas confirmadas hoy.'
    : `${Confirmadas} reserva${Confirmadas === 1 ? '' : 's'} confirmada${Confirmadas === 1 ? '' : 's'} hoy.`;

  const Html = Rellenarplantilla(
    Cargarplantilla('Informediario'),
    {
      DIASEMANA: Diasemana,
      FECHACORTA: Fechacorta,
      HORAGENERADO: Utilities.formatDate(Ahora, Datoscorreo.zonahoraria, 'HH:mm'),
      RECAUDO: Formatearpesos(Recaudo),
      TEXTOCONFIRMADAS: Textoconfirmadas,
      OCUPADAS: Ocupadas,
      TOTALHAB: Totalhab,
      PORCENTAJE: Porcentaje,
      LLEGADAS: Llegadas.length,
      SALIDAS: Salidas.length,
      PENDIENTES: Pendientes,
      NUEVOSUSUARIOS: Nuevosusuarios
    },
    {
      BARRA: Construirbarraocupacion(Porcentaje),
      HABITACIONES: Construirfilashabitaciones(Filashab),
      LLEGADAS: Construirtarjetasmovimiento(Llegadas, 'llegada', Zonalibro),
      SALIDAS: Construirtarjetasmovimiento(Salidas, 'salida', Zonalibro)
    }
  );

  MailApp.sendEmail({
    to: Credenciales.correoadmin,
    subject: `Informe diario · ${Diasemana} ${Fechacorta} · $${Formatearpesos(Recaudo)} COP`,
    htmlBody: Html,
    body:
      `Informe diario Hospedaje Nissi (${Hoy})\n` +
      `Recaudo validado hoy: $${Formatearpesos(Recaudo)} COP (${Textoconfirmadas})\n` +
      `Ocupación: ${Ocupadas}/${Totalhab} · Llegadas: ${Llegadas.length} · Salidas: ${Salidas.length}\n` +
      `Pendientes de pago: ${Pendientes} · Cuentas nuevas: ${Nuevosusuarios}`,
    name: `${Datoscorreo.remitente} · Recepción`
  });
}

function Construirbarraocupacion(Porcentaje) {
  const Celda = function(Ancho, Color, Radio) {
    return `<td width="${Ancho}%" height="6" bgcolor="${Color}" style="background:${Color};height:6px;font-size:0;line-height:0;border-radius:${Radio};">&nbsp;</td>`;
  };
  let Celdas;
  if (Porcentaje <= 0) {
    Celdas = Celda(100, '#2A2D20', '6px');
  } else if (Porcentaje >= 100) {
    Celdas = Celda(100, '#4DD678', '6px');
  } else {
    Celdas = Celda(Porcentaje, '#4DD678', '6px 0 0 6px') + Celda(100 - Porcentaje, '#2A2D20', '0 6px 6px 0');
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>${Celdas}</tr></table>`;
}

function Construirfilashabitaciones(Filashab) {
  return Filashab.map(function(Hab) {
    const Ocupada = String(Hab[5]) === 'Ocupada';
    const Fondo = Ocupada ? '#EBD3C6' : '#DDE2CC';
    const Color = Ocupada ? '#8C3B1F' : '#4F5A2E';
    const Borde = 'border-top:1px solid #D9CDB5;';
    return (
      `<tr>` +
      `<td width="56" valign="middle" style="width:56px;padding:14px 0;${Borde}font-family:${Fuenteserif};font-size:26px;line-height:28px;font-weight:300;color:#1A1C13;">${Escaparhtmlservidor(String(Hab[0]).padStart(2, '0'))}</td>` +
      `<td valign="middle" style="padding:14px 0;${Borde}font-family:${Fuentesans};font-size:14px;line-height:20px;color:#3A3C30;"><strong style="color:#1A1C13;font-weight:600;">${Escaparhtmlservidor(Hab[1])}</strong><br><span style="font-size:12px;color:#5A5C4E;">${Escaparhtmlservidor(Hab[2])}</span></td>` +
      `<td valign="middle" align="right" style="padding:14px 0;${Borde}"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${Fondo};font-family:${Fuentesans};font-size:12px;line-height:16px;font-weight:600;color:${Color};">${Escaparhtmlservidor(Hab[5])}</span></td>` +
      `</tr>`
    );
  }).join('');
}

function Construirtarjetasmovimiento(Filas, Tipo, Zonalibro) {
  if (!Filas.length) {
    const Mensaje = Tipo === 'llegada' ? 'No hay llegadas programadas para hoy.' : 'No hay salidas programadas para hoy.';
    return `<p style="margin:0;padding:18px 20px;border-radius:16px;background:#E7DCC6;font-family:${Fuentesans};font-size:14px;line-height:20px;color:#5A5C4E;">${Mensaje}</p>`;
  }

  return Filas.map(function(Fila) {
    const Total = Number(Fila[10] || 0);
    const Pagado = Number(Fila[11] || 0);
    const Saldo = Math.max(0, Total - Pagado);
    const Entidad = String(Fila[13] || '').trim();
    const Referencia = String(Fila[12] || '').trim();
    const Detallehora = Tipo === 'llegada' ? Formatearhora(Fila[9], Zonalibro) : 'Antes de 12:00';

    let Detallepago = `Pagó <strong style="color:#8C3B1F;">$${Formatearpesos(Pagado)} COP</strong>`;
    if (Entidad) {
      Detallepago += ` · ${Escaparhtmlservidor(Entidad)}`;
    }
    if (Referencia) {
      Detallepago += ` · Ref. ${Escaparhtmlservidor(Referencia)}`;
    }
    if (Saldo > 0) {
      Detallepago += `<br><strong style="color:#1A1C13;">Saldo por cobrar: $${Formatearpesos(Saldo)} COP</strong>`;
    }

    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E7DCC6" style="background:#E7DCC6;border-radius:16px;margin-bottom:10px;">` +
      `<tr><td style="padding:18px 20px;font-family:${Fuentesans};">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td style="font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#5A5C4E;">Hab. ${Escaparhtmlservidor(String(Fila[4]).padStart(2, '0'))} · ${Escaparhtmlservidor(Fila[0])}</td>` +
      `<td align="right" style="font-size:13px;line-height:16px;font-weight:600;color:#1A1C13;">${Escaparhtmlservidor(Detallehora)}</td>` +
      `</tr></table>` +
      `<span style="display:block;margin-top:8px;font-family:${Fuenteserif};font-size:21px;line-height:25px;color:#1A1C13;">${Escaparhtmlservidor(Fila[2])}</span>` +
      `<span style="display:block;margin-top:4px;font-size:13px;line-height:19px;color:#3A3C30;">Cel. ${Escaparhtmlservidor(Fila[3])} · ${Detallepago}</span>` +
      `</td></tr></table>`
    );
  }).join('');
}

// Ejecuta esta funcion desde el editor para recibir el informe de hoy en este momento
function Probarinformediario() {
  Enviarinformecorreodiario();
}

// Recuperacion de contraseña enviada por el servidor
// Solo se usa si en js/Datosinicial.js activas recuperacionporservidor: true
// Requiere permisos adicionales en el proyecto de Firebase (ver README, seccion Recuperar contraseña)

// Cambia la pagina generica de Firebase por la pagina propia Recuperarclave.html conservando el codigo de seguridad
function Construirenlacerecuperacion(Enlacefirebase) {
  const Coincidencia = String(Enlacefirebase || '').match(/[?&]oobCode=([^&#]+)/);
  if (!Coincidencia) {
    return Enlacefirebase;
  }
  return `${Datoscorreo.urlsitio}/Recuperarclave.html?mode=resetPassword&oobCode=${Coincidencia[1]}`;
}

function Procesarrecuperacionclave(Correo) {
  const Respuestaneutra = { exito: true, mensaje: 'Si el correo tiene una cuenta, recibirá un enlace.' };
  const Correolimpio = String(Correo || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(Correolimpio)) {
    return { exito: false, mensaje: 'Correo no válido.' };
  }

  // Maximo una solicitud cada 10 minutos por correo
  const Cache = CacheService.getScriptCache();
  const Clavecache = 'RECUPERAR_' + Utilities.base64EncodeWebSafe(Correolimpio).slice(0, 200);
  if (Cache.get(Clavecache)) {
    return Respuestaneutra;
  }

  if (MailApp.getRemainingDailyQuota() <= Datoscorreo.reservacuotacorreo) {
    return Respuestaneutra;
  }

  const Respuesta = UrlFetchApp.fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${Datoscorreo.proyectofirebase}/accounts:sendOobCode`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Goog-User-Project': Datoscorreo.proyectofirebase
      },
      payload: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: Correolimpio,
        returnOobLink: true
      })
    }
  );

  if (Respuesta.getResponseCode() !== 200) {
    console.warn('No se generó el enlace de recuperación: ' + Respuesta.getContentText().slice(0, 300));
    return Respuestaneutra;
  }

  const Datos = JSON.parse(Respuesta.getContentText());
  if (!Datos.oobLink) {
    return Respuestaneutra;
  }

  // El bloqueo de 10 minutos solo se activa cuando el enlace se genero de verdad
  Cache.put(Clavecache, '1', 600);

  const Enlace = Construirenlacerecuperacion(Datos.oobLink);
  const Html = Cargarplantilla('Correorecuperacion')
    .replace(/%LINK%/g, function() { return Escaparhtmlservidor(Enlace); })
    .replace(/%EMAIL%/g, function() { return Escaparhtmlservidor(Correolimpio); });

  MailApp.sendEmail({
    to: Correolimpio,
    subject: 'Restablece tu contraseña · Hospedaje Nissi',
    htmlBody: Html,
    body: `Recibimos una solicitud para cambiar la contraseña de ${Correolimpio}.\nCrea una nueva aquí (vence en 1 hora): ${Enlace}\n\nSi no fuiste tú, ignora este correo.`,
    name: Datoscorreo.remitente,
    replyTo: Obtenercredenciales().correoadmin
  });

  return Respuestaneutra;
}

// Prueba desde el editor: usa CORREOPRUEBA, que debe tener una cuenta creada en la web
function Probarrecuperacionclave() {
  const Correoprueba = Obtenercorreoprueba();
  console.log('Correo de prueba: ' + Correoprueba);
  const Respuesta = UrlFetchApp.fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${Datoscorreo.proyectofirebase}/accounts:sendOobCode`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Goog-User-Project': Datoscorreo.proyectofirebase
      },
      payload: JSON.stringify({ requestType: 'PASSWORD_RESET', email: Correoprueba, returnOobLink: true })
    }
  );
  console.log('Respuesta de Google (' + Respuesta.getResponseCode() + '): ' + Respuesta.getContentText().slice(0, 500));
  if (Respuesta.getResponseCode() === 200) {
    console.log('Permisos correctos. Enviando el correo de prueba a ' + Correoprueba);
    console.log(JSON.stringify(Procesarrecuperacionclave(Correoprueba)));
  }
}
