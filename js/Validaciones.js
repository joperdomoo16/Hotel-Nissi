// Reglas para validar datos del viajero, fechas, formatos de contacto y sanitizacion contra XSS

function Escaparhtml(Texto) {
  return String(Texto == null ? '' : Texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function Sanitizartexto(Texto, Longitudmaxima) {
  const Limite = Longitudmaxima || 120;
  return String(Texto == null ? '' : Texto)
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, Limite);
}

function Validarcorreoelectronico(Correotexto) {
  const Patrontipico = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return Patrontipico.test((Correotexto || '').trim());
}

function Validarnumerocelular(Celulartexto) {
  const Solodigitos = (Celulartexto || '').replace(/\D/g, '');
  return Solodigitos.length >= 7 && Solodigitos.length <= 13;
}

function Validarcedulacolombiana(Cedulatexto) {
  const Solodigitos = String(Cedulatexto || '').replace(/\D/g, '');
  return /^[1-9]\d{5,9}$/.test(Solodigitos);
}

function Validarrangofechas(Fechallegada, Fechasalida) {
  if (!Fechallegada || !Fechasalida) {
    return false;
  }
  const Momentollegada = new Date(Fechallegada);
  const Momentosalida = new Date(Fechasalida);
  return Momentosalida > Momentollegada;
}

function Calcularnochesestadia(Fechallegada, Fechasalida) {
  if (!Validarrangofechas(Fechallegada, Fechasalida)) {
    return 0;
  }
  const Milisegundosdia = 86400000;
  const Diferenciamilisegundos = new Date(Fechasalida) - new Date(Fechallegada);
  return Math.round(Diferenciamilisegundos / Milisegundosdia);
}

function Formatearfechalegible(Fechacadena) {
  if (!Fechacadena) {
    return '';
  }
  const Partesfecha = Fechacadena.split('-');
  if (Partesfecha.length !== 3) {
    return Fechacadena;
  }
  const Indicemes = parseInt(Partesfecha[1], 10) - 1;
  const Indicedia = parseInt(Partesfecha[2], 10);
  const Nombremes = Mesesano[Indicemes] || '';
  return `${Indicedia} ${Nombremes}`;
}

function Generarcodigoreserva() {
  const Letrasazar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NS-${Letrasazar}`;
}

