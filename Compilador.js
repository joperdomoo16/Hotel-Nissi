// Compilador para generar version de distribucion sin comentarios para Firebase Hosting

const fs = require('fs');
const path = require('path');

const Carpetaraiz = __dirname;
const Carpetadist = path.join(Carpetaraiz, 'dist');

function Limpiarcomentarioshtml(Contenido) {
  return Contenido
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*[\r\n]/gm, '');
}

function Limpiarcomentarioscss(Contenido) {
  return Contenido
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*[\r\n]/gm, '');
}

function Limpiarcomentariosjs(Codigo) {
  const Patron = /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|(?:\/(?![*\/])(?:\\.|[^\\\/\r\n])+\/[gimsuy]*))|(\/\*[\s\S]*?\*\/)|(\/\/[^\r\n]*)/g;
  return Codigo
    .replace(Patron, function(Coincidencia, Cadena) {
      if (Cadena) {
        return Cadena;
      }
      return '';
    })
    .replace(/^\s*[\r\n]/gm, '');
}

function Asegurardirectorio(Ruta) {
  if (!fs.existsSync(Ruta)) {
    fs.mkdirSync(Ruta, { recursive: true });
  }
}

function Limpiardirectorio(Ruta) {
  if (fs.existsSync(Ruta)) {
    fs.rmSync(Ruta, { recursive: true, force: true });
  }
  fs.mkdirSync(Ruta, { recursive: true });
}

function Copiardirectorio(Origen, Destino) {
  Asegurardirectorio(Destino);
  const Entradas = fs.readdirSync(Origen, { withFileTypes: true });

  Entradas.forEach(function(Entrada) {
    const Rutaorigen = path.join(Origen, Entrada.name);
    const Rutadestino = path.join(Destino, Entrada.name);

    if (Entrada.isDirectory()) {
      Copiardirectorio(Rutaorigen, Rutadestino);
    } else {
      fs.copyFileSync(Rutaorigen, Rutadestino);
    }
  });
}

function Procesardirectoriocss() {
  const Carpetacss = path.join(Carpetaraiz, 'css');
  const Destinocss = path.join(Carpetadist, 'css');
  Asegurardirectorio(Destinocss);

  const Archivos = fs.readdirSync(Carpetacss);
  Archivos.forEach(function(Nombrearchivo) {
    if (Nombrearchivo.endsWith('.css')) {
      const Contenidooriginal = fs.readFileSync(path.join(Carpetacss, Nombrearchivo), 'utf8');
      const Contenidolimpio = Limpiarcomentarioscss(Contenidooriginal);
      fs.writeFileSync(path.join(Destinocss, Nombrearchivo), Contenidolimpio, 'utf8');
    }
  });
}

function Procesardirectoriojs() {
  const Carpetajs = path.join(Carpetaraiz, 'js');
  const Destinojs = path.join(Carpetadist, 'js');
  Asegurardirectorio(Destinojs);

  const Archivos = fs.readdirSync(Carpetajs);
  Archivos.forEach(function(Nombrearchivo) {
    if (Nombrearchivo.endsWith('.js')) {
      const Contenidooriginal = fs.readFileSync(path.join(Carpetajs, Nombrearchivo), 'utf8');
      const Contenidolimpio = Limpiarcomentariosjs(Contenidooriginal);
      fs.writeFileSync(path.join(Destinojs, Nombrearchivo), Contenidolimpio, 'utf8');
    }
  });
}

function Procesararchivoshtml() {
  const Paginas = ['index.html', 'Administracion.html'];
  Paginas.forEach(function(Nombrepagina) {
    const Rutapagina = path.join(Carpetaraiz, Nombrepagina);
    if (fs.existsSync(Rutapagina)) {
      const Contenidooriginal = fs.readFileSync(Rutapagina, 'utf8');
      const Contenidolimpio = Limpiarcomentarioshtml(Contenidooriginal);
      fs.writeFileSync(path.join(Carpetadist, Nombrepagina), Contenidolimpio, 'utf8');
    }
  });
}

function Copiararchivosestaticos() {
  const Carpetaassets = path.join(Carpetaraiz, 'assets');
  if (fs.existsSync(Carpetaassets)) {
    Copiardirectorio(Carpetaassets, path.join(Carpetadist, 'assets'));
  }

  const Archivosraiz = ['robots.txt', 'sitemap.xml', 'manifest.json'];
  Archivosraiz.forEach(function(Nombrearchivo) {
    const Rutafuente = path.join(Carpetaraiz, Nombrearchivo);
    if (fs.existsSync(Rutafuente)) {
      fs.copyFileSync(Rutafuente, path.join(Carpetadist, Nombrearchivo));
    }
  });
}

function Ejecutarcompilacion() {
  console.log('[Compilador] Iniciando preparación de distribución limpia en dist/...');
  Limpiardirectorio(Carpetadist);

  Copiararchivosestaticos();
  Procesararchivoshtml();
  Procesardirectoriocss();
  Procesardirectoriojs();

  console.log('[Compilador] Compilación finalizada con éxito. Código limpio en dist/ listo para hosting.');
}

Ejecutarcompilacion();

