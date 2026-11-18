// Catalogo de habitaciones, tarifas en pesos colombianos y datos iniciales del hospedaje
const Configuracionhotel = {
  celular: '573001234567',
  urlservidor: 'https://script.google.com/macros/s/AKfycbwtFwQcPEmpUm2thTlLmChpiyg5h81LVBp2dK3ZXI3J-HukMWhzRbzD2nBseM2zJN2H-w/exec',
  mostrarcortina: true,
  cursorpersonalizado: true,
  nombre: 'Hospedaje Nissi',
  corregimiento: 'Mingueo',
  municipio: 'Dibulla',
  departamento: 'La Guajira',
  direccion: 'Troncal del Caribe, Mingueo, Dibulla, La Guajira',
  mapas: 'https://maps.app.goo.gl/TudMNAdQRpVyzHZGA',
  waze: 'https://waze.com/ul?ll=11.216310,-73.392264&navigate=yes',
  urlsitio: 'https://hospedaje-nissi-mingueo.web.app/',
  // false: el correo de recuperacion lo envia Firebase con la plantilla de la consola
  // true: lo envia Apps Script con correos/Correorecuperacion.html (alternativa B del README)
  recuperacionporservidor: true
};

const Habitacioneshotel = [
  {
    numero: '01',
    tipo: 'Triple · Queen + Sencilla',
    capacidad: '1 a 3 personas',
    huespedesmaximos: 3,
    admitecamasseparadas: true,
    descripcion: 'Una cama queen y una cama sencilla. Aire acondicionado, Wi-Fi, TV y acceso al parqueadero general.',
    detalles: ['1 cama queen + 1 sencilla', 'Aire acondicionado', 'Wi-Fi', 'TV', 'Parqueadero'],
    precio: 55000,
    foto: 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '02',
    tipo: 'Triple · Queen + Sencilla',
    capacidad: '1 a 3 personas',
    huespedesmaximos: 3,
    admitecamasseparadas: true,
    descripcion: 'Una cama queen y una cama sencilla. Aire acondicionado, Wi-Fi, TV y acceso al parqueadero general.',
    detalles: ['1 cama queen + 1 sencilla', 'Aire acondicionado', 'Wi-Fi', 'TV', 'Parqueadero'],
    precio: 55000,
    foto: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '03',
    tipo: 'Habitación 03',
    capacidad: 'No disponible temporalmente',
    huespedesmaximos: 0,
    mantenimiento: true,
    descripcion: 'No disponible temporalmente, te invitamos a ver las demás habitaciones.',
    detalles: [],
    precio: 0,
    foto: 'https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '04',
    tipo: 'Doble',
    capacidad: '1 a 2 personas',
    huespedesmaximos: 2,
    admitecamasseparadas: false,
    descripcion: 'Una cama doble cómoda y tranquila, con aire acondicionado, Wi-Fi, TV y parqueadero.',
    detalles: ['1 cama doble', 'Aire acondicionado', 'Wi-Fi', 'TV', 'Parqueadero'],
    precio: 55000,
    foto: 'https://images.pexels.com/photos/262048/pexels-photo-262048.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '05',
    tipo: 'Doble',
    capacidad: '1 a 2 personas',
    huespedesmaximos: 2,
    admitecamasseparadas: false,
    descripcion: 'Una cama doble ideal para descansar en Mingueo, con aire acondicionado, Wi-Fi, TV y parqueadero.',
    detalles: ['1 cama doble', 'Aire acondicionado', 'Wi-Fi', 'TV', 'Parqueadero'],
    precio: 55000,
    foto: 'https://images.pexels.com/photos/237371/pexels-photo-237371.jpeg?auto=compress&cs=tinysrgb&w=1600'
  },
  {
    numero: '06',
    tipo: 'Triple · Doble + Sencilla',
    capacidad: '1 a 3 personas',
    huespedesmaximos: 3,
    admitecamasseparadas: true,
    descripcion: 'Una cama doble y una cama sencilla, equipada con aire acondicionado, Wi-Fi, TV y parqueadero.',
    detalles: ['1 cama doble + 1 sencilla', 'Aire acondicionado', 'Wi-Fi', 'TV', 'Parqueadero'],
    precio: 55000,
    foto: 'https://images.pexels.com/photos/6585757/pexels-photo-6585757.jpeg?auto=compress&cs=tinysrgb&w=1600'
  }
];

const Mensajeschat = [
  { mio: true, texto: 'Hola, ¿tienen habitación para esta noche? Somos 2.' },
  { mio: false, texto: 'Hola, soy el asistente de Hospedaje Nissi. Hoy tenemos disponible la 03 (doble). ¿A qué hora llegan?' },
  { mio: true, texto: 'Como a las 10 pm, venimos de Santa Marta.' },
  { mio: false, texto: 'Perfecto. Te envío el resumen y la tarifa para confirmar. La recepción queda avisada.' }
];

const Mesesano = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
