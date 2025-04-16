// public/parser/parseOBJ.js

(function () {
  function getBounds(vertices) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    vertices.forEach(({ x, z }) => {
      if (x < minX) minX = x;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (z > maxZ) maxZ = z;
    });
    return { minX, minZ, maxX, maxZ };
  }

  function normalize(vertices, width, height, padding = 5) {
    const { minX, minZ, maxX, maxZ } = getBounds(vertices);
    const scaleX = (width - 2 * padding) / (maxX - minX || 1);
    const scaleZ = (height - 2 * padding) / (maxZ - minZ || 1);
    const scale = Math.min(scaleX, scaleZ);
  
    const offsetX = (width - ((maxX - minX) * scale)) / 2;
    const offsetZ = (height - ((maxZ - minZ) * scale)) / 2;
  
    return vertices.map(({ x, z }) => ({
      x: width - ((x - minX) * scale + offsetX),   // Invertir X
      z: height - ((z - minZ) * scale + offsetZ)    // Invertir Z
    }));
  }

  function ordenarPorAngulo(puntos) {
    if (!puntos.length) return puntos;
    const cx = puntos.reduce((sum, p) => sum + p.x, 0) / puntos.length;
    const cz = puntos.reduce((sum, p) => sum + p.z, 0) / puntos.length;
    return puntos.slice().sort((a, b) => {
      const angA = Math.atan2(a.z - cz, a.x - cx);
      const angB = Math.atan2(b.z - cz, b.x - cx);
      return angA - angB;
    });
  }

  window.parseOBJ = function (textoOBJ) {
    console.log("📄 .OBJ recibido:", textoOBJ.slice(0, 300));

    const lines = textoOBJ.split("\n");
    const vertices = [];
    const ceilingPorRoom = {};
    const verticesPorPunto = {}; // para rastrear qué wall contiene cada vértice
    let currentRoom = null;
    let currentWall = null;
    let parsingCeiling = false;

    lines.forEach(line => {
      if (line.startsWith("g ")) {
        const partes = line.trim().split(/\s+/);
        const room = partes.find(p => /^room\d+$/i.test(p));
        currentRoom = room ? room.toLowerCase() : null;
        const wall = partes.find(p => /^wall\d+$/i.test(p));
        const isCeiling = partes.includes("ceiling");

        if (currentRoom) {
          parsingCeiling = isCeiling;
          if (parsingCeiling && !ceilingPorRoom[currentRoom]) ceilingPorRoom[currentRoom] = [];
          currentWall = wall ? wall.toLowerCase() : null;
        }
      }
      else if (line.startsWith("v ")) {
        const [, x, y, z] = line.trim().split(/\s+/).map(Number);
        const vertice = { x: +x.toFixed(5), y: +y.toFixed(5), z: +z.toFixed(5) };
        if (parsingCeiling && currentRoom) {
          ceilingPorRoom[currentRoom].push(vertice);
        } else if (currentRoom && currentWall) {
          const key = `${vertice.x},${vertice.z}`;
          if (!verticesPorPunto[key]) verticesPorPunto[key] = new Set();
          verticesPorPunto[key].add(currentWall);
        }
      }
    });

    window.geometriaPorRoom = {};

    // Imprimimos verticesPorPunto
    console.log("\n--- verticesPorPunto ---");
    console.log(verticesPorPunto);

    // Imprimimos algunos vértices originales
    console.log("\n--- Primeros 10 Vértices Originales ---");
    for (let room in ceilingPorRoom) {
      const verticesCrudos = ceilingPorRoom[room];
      const puntosXZ = verticesCrudos.map(v => ({ x: +(-v.x).toFixed(5), z: +(-v.z).toFixed(5) }));

      const claves = new Set();
      const puntosUnicos = puntosXZ.filter(p => {
        const clave = `${p.x},${p.z}`;
        if (claves.has(clave)) return false;
        claves.add(clave);
        return true;
      });

      const ordenados = ordenarPorAngulo(puntosUnicos);

      const tramos = [];
      for (let i = 0; i < ordenados.length; i++) {
        const a = ordenados[i];
        const b = ordenados[(i + 1) % ordenados.length];
        tramos.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
      }

      function paredesDePunto(punto, verticesPorPunto, tramo) {
        console.log(`\n--- paredesDePunto para punto: (${punto.x}, ${punto.z}) ---`);
        const walls = new Set();
        let found = false;
      
        const puntoKey = `${punto.x.toFixed(5)},${(punto.z || 0).toFixed(5)}`; // Creamos la clave del punto
      
        if (verticesPorPunto[puntoKey]) { // Buscamos la clave directamente
          verticesPorPunto[puntoKey].forEach(wall => {
            console.log(`    Encontrado wall: ${wall}`);
            walls.add(wall);
          });
          found = true;
        }
      
        if (!found) {
          console.log("  No se encontraron paredes para este punto.");
          if (tramo) {
            console.log(`  Tramo: (${tramo.x1}, ${tramo.z1}) - (${tramo.x2}, ${tramo.z2})`);
          }
        }
      
        const wallsArray = Array.from(walls);
        console.log(`  Paredes encontradas: ${wallsArray}`);
        return wallsArray;
      }
        
        const paredes = tramos.map(tramo => {
          const wallsP1 = paredesDePunto({ x: tramo.x1, z: tramo.z1 }, vertices);
          const wallsP2 = paredesDePunto({ x: tramo.x2, z: tramo.z2 }, vertices);
          const comunes = wallsP1.filter(w => wallsP2.includes(w));
          return { ...tramo, wallId: comunes[0] || null };
        });      

      const sueloNorm = normalize(ordenados, 500, 500);
      const extremosNorm = normalize(paredes.flatMap(p => [
        { x: p.x1, z: p.z1 },
        { x: p.x2, z: p.z2 }
      ]), 500, 500);

      let i = 0;
      const paredesNorm = paredes.map(p => {
        const p1 = extremosNorm[i++];
        const p2 = extremosNorm[i++];
        return {
          x1: p1.x, z1: p1.z,
          x2: p2.x, z2: p2.z,
          wallId: p.wallId
        };
      });

      window.geometriaPorRoom[room] = {
        suelo: sueloNorm,
        paredes: paredesNorm
      };
    }

    console.log("✅ OBJ parseado y ceiling interpretado. Rooms:", Object.keys(window.geometriaPorRoom));
  };
})();
