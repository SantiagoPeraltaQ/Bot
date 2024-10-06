const fs = require('fs');
const archivoLog = 'core.class.log';
const archivoSalida = 'output.csv';

fs.readFile(archivoLog, 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const lineas = data.split('\n');
  const pushNames = [];
  const bodies = [];

  lineas.forEach((linea) => {
    if (linea.includes('pushName')) {
      pushNames.push(linea.trim());
    } else if (linea.includes('body')) {
      bodies.push(linea.trim());
    }
  });

  if (pushNames.length > 0 && bodies.length > 0) {
    const contenidoCSV = pushNames.map((pushName, index) => {
      return `${pushName},${bodies[index]}`;
    }).join('\n');
    fs.writeFile(archivoSalida, contenidoCSV, (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log('Archivo generado con éxito');
      }
    });
  } else {
    console.log('No se encontraron líneas que coincidan con los criterios');
  }
});



