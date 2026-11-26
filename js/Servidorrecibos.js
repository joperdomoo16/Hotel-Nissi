// Generación de Recibo de Caja en PDF, lectura automática de RUT (PDF/imagen) y envío por WhatsApp/Correo

function Generarnumerorecibocaja() {
  const Bloqueo = LockService.getScriptLock();
  Bloqueo.waitLock(5000);
  try {
    const Props = PropertiesService.getScriptProperties();
    const Actual = parseInt(Props.getProperty('CONSECUTIVORECIBO') || '502', 10) || 502;
    const Siguiente = Actual + 1;
    Props.setProperty('CONSECUTIVORECIBO', String(Siguiente));
    const Aamm = Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'yyMM');
    return `RC-${Aamm}-${String(Siguiente).padStart(4, '0')}`;
  } finally {
    Bloqueo.releaseLock();
  }
}

function Formatearpesosrecibo(Valor) {
  const Numero = Math.round(Number(Valor) || 0);
  return `${String(Numero).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},00`;
}

function Formatearfecharecibo(Fecha) {
  const F = Fecha || new Date();
  const Dia = Utilities.formatDate(F, Parametrosistema.zonahoraria, 'd');
  const Mes = parseInt(Utilities.formatDate(F, Parametrosistema.zonahoraria, 'M'), 10) - 1;
  const Anio = Utilities.formatDate(F, Parametrosistema.zonahoraria, 'yyyy');
  return `${Dia} de ${Mesescorreo[Mes] || 'enero'} de ${Anio}`;
}

function Numeroaletrasbasico(Numero) {
  const Unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const Decenas = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const Centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const N = Math.floor(Number(Numero) || 0);
  if (N === 0) { return ''; }
  if (N === 100) { return 'CIEN'; }
  if (N < 30) { return Unidades[N]; }
  if (N < 100) {
    const D = Math.floor(N / 10), U = N % 10;
    return U ? `${Decenas[D]} Y ${Unidades[U]}` : Decenas[D];
  }
  const C = Math.floor(N / 100), Resto = N % 100;
  return Resto ? `${Centenas[C]} ${Numeroaletrasbasico(Resto)}` : Centenas[C];
}

function Numeroaletraspesos(Monto) {
  const Total = Math.round(Number(Monto) || 0);
  if (Total <= 0) { return 'CERO PESOS M/CTE.'; }
  const Millones = Math.floor(Total / 1000000);
  const Restomillones = Total % 1000000;
  const Miles = Math.floor(Restomillones / 1000);
  const Unidades = Restomillones % 1000;
  const Partes = [];
  if (Millones > 0) {
    Partes.push(Millones === 1 ? 'UN MILLÓN' : `${Numeroaletrasbasico(Millones)} MILLONES`);
  }
  if (Miles > 0) {
    Partes.push(Miles === 1 ? 'MIL' : `${Numeroaletrasbasico(Miles)} MIL`);
  }
  if (Unidades > 0) {
    Partes.push(Numeroaletrasbasico(Unidades));
  }
  const Sufijo = (Millones > 0 && Miles === 0 && Unidades === 0) ? 'DE PESOS M/CTE.' : 'PESOS M/CTE.';
  return `${Partes.join(' ').trim()} ${Sufijo}`;
}

function Analizarcomprobanteimagen(Idimagenwhatsapp) {
  const Idlimpio = String(Idimagenwhatsapp || '').trim();
  if (!/^[A-Za-z0-9_-]{5,120}$/.test(Idlimpio)) {
    return { escomprobante: false, detalle: 'Identificador de imagen no válido.' };
  }
  const Credenciales = Obtenercredenciales();
  const Respuestameta = UrlFetchApp.fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(Idlimpio)}`, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });
  const Datosmeta = JSON.parse(Respuestameta.getContentText());
  if (!Datosmeta || !Esurlmediameta(Datosmeta.url)) {
    Registrarbitacora('Seguridad', 'UrlMediaRechazada', 'URL de descarga fuera de dominios autorizados.');
    return { escomprobante: false, detalle: 'Origen de imagen no autorizado.' };
  }
  const Descargaimagen = UrlFetchApp.fetch(Datosmeta.url, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });
  const Bytesbase = Utilities.base64Encode(Descargaimagen.getBlob().getBytes());
  const Tipomime = Descargaimagen.getBlob().getContentType() || 'image/jpeg';
  const Solicitudgemini = {
    model: Parametrosistema.modeloia,
    input: [
      { type: 'text', text: 'Analiza esta captura de pantalla de un comprobante de pago en Colombia (Nequi o transferencia bancaria a Nequi). Extrae exactamente en formato JSON sin bloques markdown: {"escomprobante": true/false, "monto": numero en pesos sin puntos ni decimales, "referencia": "numero de comprobante o referencia", "entidad": "Nequi/Bancolombia/Otro", "fecha": "YYYY-MM-DD HH:mm", "nombredestino": "nombre exacto del destinatario o producto destino", "numerodestino": "numero Nequi o celular destino solo digitos"}.' },
      { type: 'image', data: Bytesbase, mime_type: Tipomime }
    ]
  };
  const Textosalida = Extraertextointeraccion(Llamarapigemini(Credenciales.clavegemini, Solicitudgemini));
  try {
    return JSON.parse(Textosalida.replace(/```json|```/g, '').trim());
  } catch (Errorjson) {
    return { escomprobante: false, detalle: Textosalida };
  }
}

function Analizarrutdocumento(Idmediawhatsapp, Tipomimeforzado) {
  const Idlimpio = String(Idmediawhatsapp || '').trim();
  if (!/^[A-Za-z0-9_-]{5,120}$/.test(Idlimpio)) {
    return { esrut: false, detalle: 'Identificador de archivo no válido.' };
  }
  const Credenciales = Obtenercredenciales();
  const Respuestameta = UrlFetchApp.fetch(`https://graph.facebook.com/v25.0/${encodeURIComponent(Idlimpio)}`, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });
  const Datosmeta = JSON.parse(Respuestameta.getContentText());
  if (!Datosmeta || !Esurlmediameta(Datosmeta.url)) {
    Registrarbitacora('Seguridad', 'UrlRutRechazada', 'URL de descarga fuera de dominios autorizados.');
    return { esrut: false, detalle: 'Origen de archivo no autorizado.' };
  }
  const Descarga = UrlFetchApp.fetch(Datosmeta.url, {
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` }
  });
  const Blobarchivo = Descarga.getBlob();
  const Tipomime = Tipomimeforzado || Blobarchivo.getContentType() || 'application/pdf';
  const Tipobloque = Tipomime.indexOf('pdf') !== -1 ? 'document' : 'image';
  const Bytesbase = Utilities.base64Encode(Blobarchivo.getBytes());

  const Prompt = 'Analiza este documento o imagen de un RUT (Registro Único Tributario de la DIAN Colombia). Extrae exactamente en JSON sin markdown: ' +
    '{"esrut": true/false, "tipocontribuyente": "Natural/Juridica", "nombre": "Nombre completo en orden natural (Primer nombre + Otros nombres + Primer apellido + Segundo apellido) o Razón social si es empresa", ' +
    '"documento": "NIT con dígito de verificación si aparece (casilla 5 y 6, ej. 91.515.081-9) o número de cédula", "direccion": "casilla 41 dirección principal", ' +
    '"ciudad": "casilla 40 Ciudad/Municipio, casilla 39 Departamento", "telefono": "casilla 44 o 45 teléfono", "correorut": "casilla 42 correo electrónico"}.';

  const Respuestagemini = Llamarapigemini(Credenciales.clavegemini, {
    model: Parametrosistema.modeloia,
    input: [{ type: 'text', text: Prompt }, { type: Tipobloque, data: Bytesbase, mime_type: Tipomime }]
  });
  const Textosalida = Extraertextointeraccion(Respuestagemini);
  try {
    return JSON.parse(Textosalida.replace(/```json|```/g, '').trim());
  } catch (E) {
    return { esrut: false, detalle: Textosalida };
  }
}

function Subirmediawhatsapp(Blobarchivo, Tipomime, Nombrearchivo) {
  const Credenciales = Obtenercredenciales();
  if (!Credenciales.tokenwhatsapp || !Credenciales.idtelefonowhatsapp) { return ''; }
  const Url = `https://graph.facebook.com/v25.0/${Credenciales.idtelefonowhatsapp}/media`;
  const Archivo = Blobarchivo.copyBlob().setName(Nombrearchivo);
  const Respuesta = UrlFetchApp.fetch(Url, {
    method: 'post',
    muteHttpExceptions: true,
    headers: { Authorization: `Bearer ${Credenciales.tokenwhatsapp}` },
    payload: { messaging_product: 'whatsapp', type: Tipomime || 'application/pdf', file: Archivo }
  });
  try {
    const Datos = JSON.parse(Respuesta.getContentText());
    if (Respuesta.getResponseCode() >= 300) {
      Registrarbitacora('WhatsAppMedia', `ErrorSubida_${Respuesta.getResponseCode()}`, Respuesta.getContentText());
      return '';
    }
    return Datos.id || '';
  } catch (E) { return ''; }
}

function Enviardocumentowhatsapp(Numerodestino, Blobarchivo, Nombrearchivo, Leyenda) {
  const Idmedia = Subirmediawhatsapp(Blobarchivo, 'application/pdf', Nombrearchivo);
  if (!Idmedia) { return ''; }
  return Peticionwhatsapp({
    messaging_product: 'whatsapp',
    to: Normalizaridwhatsapp(Numerodestino),
    type: 'document',
    document: { id: Idmedia, filename: Nombrearchivo, caption: String(Leyenda || '').slice(0, 1024) }
  }, 'WhatsAppRecibo');
}

function Buscarreservaconfirmadacliente(Celularcliente, Codigoreserva) {
  const Hoja = Obtenerhojareservas();
  if (!Hoja || Hoja.getLastRow() < 2) { return null; }
  const Celularlimpio = Normalizaridwhatsapp(Celularcliente);
  const Filas = Hoja.getRange(2, 1, Hoja.getLastRow() - 1, 28).getValues();
  for (let I = Filas.length - 1; I >= 0; I--) {
    if (Coincidereservacliente(Filas[I], Codigoreserva, Celularlimpio) && String(Filas[I][15]) === 'Confirmada') {
      return { indice: I + 2, fila: Filas[I], hoja: Hoja };
    }
  }
  return null;
}

function Construirhtmlrecibocaja(Datosrecibo) {
  const Bloques = { PARQUEO: '', OBSPARQUEO: '' };
  if (Datosrecibo.tieneparqueadero) {
    Bloques.PARQUEO = `<div>${Escaparhtmlservidor(Datosrecibo.detalleparqueo)}</div>`;
    Bloques.OBSPARQUEO = `<div>${Escaparhtmlservidor(Datosrecibo.observacionparqueo)}</div>`;
  }
  return Rellenarplantilla(Cargarplantilla('Recibocaja'), {
    NUMERORECIBO: Datosrecibo.numerorecibo,
    FECHARECIBO: Datosrecibo.fecharecibo,
    TOTALFORMATO: Datosrecibo.totalformato,
    NOMBRETITULAR: Datosrecibo.nombretitular,
    DOCUMENTOTITULAR: Datosrecibo.documentotitular,
    DIRECCIONTITULAR: Datosrecibo.direcciontitular,
    CIUDADTITULAR: Datosrecibo.ciudadtitular,
    TELEFONOTITULAR: Datosrecibo.telefonotitular,
    CONCEPTORESUMEN: Datosrecibo.conceptoresumen,
    DETALLECONCEPTO: Datosrecibo.detalleconcepto,
    DETALLEPARQUEO: Datosrecibo.detalleparqueo || '',
    VALORLETRAS: Datosrecibo.valorletras,
    VALORBANCO: Datosrecibo.valorbanco,
    VALOREFECTIVO: Datosrecibo.valorefectivo,
    CUENTABANCO: Datosrecibo.cuentabanco,
    FORMAPAGO: Datosrecibo.formapago,
    LINEAOBSERVACION: Datosrecibo.lineaobservacion,
    OBSERVACIONPARQUEO: Datosrecibo.observacionparqueo || '',
    CORREOCLIENTE: Datosrecibo.correocliente
  }, Bloques);
}

function Emitirrecibocaja(Celularcliente, Parametros) {
  const P = Parametros || {};
  const Encontrado = Buscarreservaconfirmadacliente(Celularcliente, P.codigoreserva);
  if (!Encontrado) {
    return { exito: false, mensaje: 'No se encontró una reserva confirmada activa para emitir el recibo de caja.' };
  }
  const Fila = Encontrado.fila;
  const Codigo = String(Fila[0]);
  const Canalenvio = String(P.canalenvio || 'whatsapp').toLowerCase();
  const Correocliente = String(P.correocliente || '').trim();
  if (!Correocliente || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Correocliente)) {
    return { exito: false, mensaje: 'Falta confirmar el correo electrónico válido del cliente para el recibo de caja.' };
  }
  const Nombretitular = String(P.nombretitular || Fila[2] || '').trim().toUpperCase();
  const Documentotitular = String(P.documentotitular || Fila[3] || '').trim();
  const Direcciontitular = String(P.direcciontitular || '').trim().toUpperCase();
  const Ciudadtitular = String(P.ciudadtitular || '').trim();
  const Telefonotitular = String(P.telefonotitular || Obtenercelularlegiblereserva(Fila) || '').trim();
  if (!Nombretitular || !Documentotitular || !Direcciontitular || !Ciudadtitular || !Telefonotitular) {
    return { exito: false, mensaje: 'Faltan datos del titular (nombre, documento, dirección, ciudad o teléfono) para generar el recibo.' };
  }

  const Noches = Math.max(1, Number(Fila[8] || 1));
  const Hab = String(Fila[5] || '01').padStart(2, '0');
  const Llegada = Normalizarfecha(Fila[6]);
  const Salida = Normalizarfecha(Fila[7]);
  const Total = Number(Fila[11] || 0);
  const Pagado = Number(Fila[12] || 0);
  const Valorrecibo = Pagado > 0 ? Pagado : Total;
  const Tarifanoche = Math.round(Valorrecibo / Noches);
  const Mediopago = String(Fila[18] || Fila[14] || 'Efectivo').trim();
  const Obsreserva = String(Fila[23] || '');
  const Matchparqueo = Obsreserva.match(/Parqueadero:\s*([^·]+)/i);
  const Parqueotexto = Matchparqueo ? Matchparqueo[1].trim() : '';
  const Tieneparqueadero = Boolean(Parqueotexto && !/^no\b/i.test(Parqueotexto));

  const Numerorecibo = Generarnumerorecibocaja();
  const Esnequi = /nequi|transferencia|bancolombia/i.test(Mediopago);
  const Esmixto = /mixt/i.test(Mediopago);
  const Config = Leerconfiguracionhoja();
  const Cuentabanco = (Esnequi || Esmixto) ? String(Config.CUENTANEQUI || 'Nequi 3126609214') : '';
  const Datosrecibo = {
    numerorecibo: Numerorecibo,
    fecharecibo: Formatearfecharecibo(new Date()),
    totalformato: Formatearpesosrecibo(Valorrecibo),
    nombretitular: Nombretitular,
    documentotitular: Documentotitular,
    direcciontitular: Direcciontitular,
    ciudadtitular: Ciudadtitular,
    telefonotitular: Telefonotitular,
    tieneparqueadero: Tieneparqueadero,
    conceptoresumen: Tieneparqueadero
      ? `Hospedaje – ${Noches} noche${Noches > 1 ? 's' : ''} y parqueadero (incluido en el valor pagado)`
      : `Hospedaje – ${Noches} noche${Noches > 1 ? 's' : ''}`,
    detalleconcepto: `Valor habitación: $${Formatearpesos(Tarifanoche)} × Noches facturadas: ${Noches} = $${Formatearpesos(Valorrecibo)}${Tieneparqueadero ? '' : ` · TOTAL: $${Formatearpesos(Valorrecibo)}`}`,
    detalleparqueo: Tieneparqueadero ? `Parqueadero (${Parqueotexto}): Incluido en el valor pagado · TOTAL: $${Formatearpesos(Valorrecibo)}` : '',
    valorletras: Numeroaletraspesos(Valorrecibo),
    valorbanco: (Esnequi || Esmixto) ? `$ ${Formatearpesosrecibo(Valorrecibo)}` : '',
    valorefectivo: (!Esnequi && !Esmixto) ? `$ ${Formatearpesosrecibo(Valorrecibo)}` : '',
    cuentabanco: Cuentabanco,
    formapago: Mediopago.toLowerCase(),
    lineaobservacion: `Reserva ${Codigo} · Habitación ${Hab} · ${Llegada} al ${Salida}.${(Esmixto && Total > Pagado) ? ` Abono Nequi: $${Formatearpesos(Pagado)} · Saldo en efectivo al llegar: $${Formatearpesos(Total - Pagado)}.` : ''}`,
    observacionparqueo: Tieneparqueadero ? `Parqueadero (${Parqueotexto}): en el valor pagado ya está incluido el costo de parqueadero.` : '',
    correocliente: Correocliente
  };

  const Html = Construirhtmlrecibocaja(Datosrecibo);
  const Nombrepdf = `Recibo_de_Caja_${Numerorecibo}_Hospedaje_Nissi.pdf`;
  const Pdfblob = HtmlService.createHtmlOutput(Html).getAs('application/pdf').setName(Nombrepdf);

  let Enviadowa = false, Enviadocorreo = false;
  if (Canalenvio === 'whatsapp' || Canalenvio === 'ambos') {
    const Destino = Normalizaridwhatsapp(Celularcliente) || Obtenerdestinowhatsappreserva(Fila);
    if (Destino) {
      Enviadowa = Boolean(Enviardocumentowhatsapp(Destino, Pdfblob, Nombrepdf, `Aquí tienes tu Recibo de Caja N° ${Numerorecibo} de Hospedaje Nissi.`));
    }
  }
  if ((Canalenvio === 'correo' || Canalenvio === 'ambos') && MailApp.getRemainingDailyQuota() > Datoscorreo.reservacuotacorreo) {
    MailApp.sendEmail({
      to: Correocliente,
      subject: `Recibo de Caja N° ${Numerorecibo} · Hospedaje Nissi`,
      body: `Hola,\n\nAdjuntamos tu Recibo de Caja N° ${Numerorecibo} correspondiente a la reserva ${Codigo} en Hospedaje Nissi (Mingueo, La Guajira).\n\nGracias por elegirnos.`,
      name: `${Datoscorreo.remitente} · Recepción`,
      attachments: [Pdfblob]
    });
    Enviadocorreo = true;
  }

  const Canalesusados = [Enviadowa ? 'WhatsApp' : '', Enviadocorreo ? `Correo (${Correocliente})` : ''].filter(Boolean).join(' y ') || Canalenvio;
  const Cred = Obtenercredenciales();
  const MensajeAdmin =
    `Recibo de caja solicitado y enviado · ${Codigo}\n` +
    `Recibo N°: ${Numerorecibo}\nTitular: ${Nombretitular} (${Documentotitular})\n` +
    `Valor: $${Formatearpesos(Valorrecibo)} COP\nEnviado al cliente por: ${Canalesusados}`;
  if (Cred.celularadmin) {
    Enviarmensajeinteligente(Cred.celularadmin, MensajeAdmin, '', []);
  }
  if (Cred.correoadmin && MailApp.getRemainingDailyQuota() > 1) {
    MailApp.sendEmail({
      to: Cred.correoadmin,
      subject: `Recibo de Caja enviado · ${Numerorecibo} · Reserva ${Codigo}`,
      body: `${MensajeAdmin}\n\nSe adjunta copia del recibo en PDF enviado al huésped.`,
      name: `${Datoscorreo.remitente} · Recepción`,
      attachments: [Pdfblob]
    });
  }

  const Obsactualizada = [Obsreserva.trim(), `Recibo ${Numerorecibo} (${Canalesusados})`].filter(Boolean).join(' · ');
  Encontrado.hoja.getRange(Encontrado.indice, 24).setValue(Sanitizarcelda(Obsactualizada, 140));
  Registrarbitacora('Recibos', 'ReciboEmitido', `${Numerorecibo} para ${Codigo} (${Canalesusados})`);

  return {
    exito: true,
    numerorecibo: Numerorecibo,
    enviadowhatsapp: Enviadowa,
    enviadocorreo: Enviadocorreo,
    canales: Canalesusados,
    mensaje: `Recibo de caja ${Numerorecibo} generado y enviado por ${Canalesusados}.`
  };
}

function Procesarrutentrante(Remitente, Idmedia, Tipomime) {
  const Datosrut = Analizarrutdocumento(Idmedia, Tipomime);
  if (Datosrut && Datosrut.esrut) {
    const Resp = Procesarmensajecongemini(
      Remitente,
      `El cliente envió su RUT y se extrajeron estos datos: ${JSON.stringify(Datosrut)}. Muéstrale los datos extraídos, pregúntale expresamente qué correo electrónico quiere usar (mencionando el correo del RUT "${Datosrut.correorut || 'no visible'}" como una opción, sin darlo por definitivo) y pregunta si desea recibir el PDF por WhatsApp, correo electrónico o ambos.`
    );
    if (Resp) { Enviarmensajewhatsapp(Remitente, Resp); }
    return true;
  }
  return false;
}

function Probarrecibocaja() {
  const Cred = Obtenercredenciales();
  const Correoprueba = typeof Obtenercorreoprueba === 'function' ? Obtenercorreoprueba() : Cred.correoadmin;
  const Numerorecibo = `RC-PRUEBA-${Utilities.formatDate(new Date(), Parametrosistema.zonahoraria, 'HHmm')}`;
  const Html = Construirhtmlrecibocaja({
    numerorecibo: Numerorecibo, fecharecibo: Formatearfecharecibo(new Date()), totalformato: Formatearpesosrecibo(55000),
    nombretitular: 'EDISSON OSWALDO ROJAS VILLAMIZAR', documentotitular: '91.515.081-9',
    direcciontitular: 'CL 16 25 30 CA 3 CONJ PRIVILEGIO BRR SAN FRANCISCO', ciudadtitular: 'Bucaramanga, Santander',
    telefonotitular: '313 453 7047', tieneparqueadero: true,
    conceptoresumen: 'Hospedaje – 1 noche y parqueadero (incluido en el valor pagado)',
    detalleconcepto: 'Valor habitación: $55.000 × Noches facturadas: 1 = $55.000',
    detalleparqueo: 'Parqueadero (Sí, 1 carro): Incluido en el valor pagado · TOTAL: $55.000',
    valorletras: Numeroaletraspesos(55000), valorbanco: '$ 55.000,00', valorefectivo: '',
    cuentabanco: String(Leerconfiguracionhoja().CUENTANEQUI || 'Nequi 3126609214'),
    formapago: 'nequi', lineaobservacion: 'Reserva NS-PRUEBA · Habitación 01 · 2026-11-26 al 2026-11-27.',
    observacionparqueo: 'Parqueadero (Sí, 1 carro): en el valor pagado ya está incluido el costo de parqueadero.',
    correocliente: Correoprueba
  });
  const Nombrepdf = `Recibo_de_Caja_${Numerorecibo}_Hospedaje_Nissi.pdf`;
  const Pdfblob = HtmlService.createHtmlOutput(Html).getAs('application/pdf').setName(Nombrepdf);
  if (Cred.celularadmin) {
    Enviardocumentowhatsapp(Cred.celularadmin, Pdfblob, Nombrepdf, `Prueba de Recibo de Caja N° ${Numerorecibo} de Hospedaje Nissi.`);
  }
  if (Correoprueba) {
    MailApp.sendEmail({
      to: Correoprueba, subject: `Prueba Recibo de Caja · ${Numerorecibo} · Hospedaje Nissi`,
      body: `Adjuntamos la prueba del Recibo de Caja ${Numerorecibo} en PDF.`,
      name: `${Datoscorreo.remitente} · Recepción`, attachments: [Pdfblob]
    });
  }
}
