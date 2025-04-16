// public/parser/parseOBJ.js

(function () {
  function getBounds(vertices) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    vertices.forEach(({ x, y }) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });
    return { minX, minY, maxX, maxY };
  }

  function normalize(vertices, width, height, padding = 5) {
    const { minX, minY, maxX, maxY } = getBounds(vertices);
    const scaleX = (width - 2 * padding) / (maxX - minX || 1);
    const scaleY = (height - 2 * padding) / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
  
    const offsetX = (width - ((maxX - minX) * scale)) / 2;
    const offsetY = (height - ((maxY - minY) * scale)) / 2;
  
    return vertices.map(({ x, y }) => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY  // inversión + centrado
    }));
  }  

  function ordenarPorAngulo(puntos) {
    if (!puntos.length) return puntos;
    const cx = puntos.reduce((sum, p) => sum + p.x, 0) / puntos.length;
    const cy = puntos.reduce((sum, p) => sum + p.y, 0) / puntos.length;
    return puntos.slice().sort((a, b) => {
      const angA = Math.atan2(a.y - cy, a.x - cx);
      const angB = Math.atan2(b.y - cy, b.x - cx);
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

    for (let room in ceilingPorRoom) {
      const verticesCrudos = ceilingPorRoom[room];
      const puntosXZ = verticesCrudos.map(v => ({ x: +(-v.x).toFixed(5), y: +(-v.z).toFixed(5) }));

      const claves = new Set();
      const puntosUnicos = puntosXZ.filter(p => {
        const clave = `${p.x},${p.y}`;
        if (claves.has(clave)) return false;
        claves.add(clave);
        return true;
      });

      const ordenados = ordenarPorAngulo(puntosUnicos);

      const tramos = [];
      for (let i = 0; i < ordenados.length; i++) {
        const a = ordenados[i];
        const b = ordenados[(i + 1) % ordenados.length];
        tramos.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }

      function paredesDePunto(punto, verticesPorPunto) {
        const walls = new Set();
        for (const key in verticesPorPunto) {
          const [x, z] = key.split(",").map(Number);
          if (Math.abs(punto.x - x) < 0.001 && Math.abs(punto.y - z) < 0.001) {
            verticesPorPunto[key].forEach(wall => walls.add(wall));
          }
        }
        return Array.from(walls);
      }
        
        const paredes = tramos.map(tramo => {
          const wallsP1 = paredesDePunto({ x: tramo.x1, y: tramo.y1 }, vertices);
          const wallsP2 = paredesDePunto({ x: tramo.x2, y: tramo.y2 }, vertices);
          const comunes = wallsP1.filter(w => wallsP2.includes(w));
          return { ...tramo, wallId: comunes[0] || null };
        });      

      const sueloNorm = normalize(ordenados, 500, 500);
      const extremosNorm = normalize(paredes.flatMap(p => [
        { x: p.x1, y: p.y1 },
        { x: p.x2, y: p.y2 }
      ]), 500, 500);

      let i = 0;
      const paredesNorm = paredes.map(p => {
        const p1 = extremosNorm[i++];
        const p2 = extremosNorm[i++];
        return {
          x1: p1.x, y1: p1.y,
          x2: p2.x, y2: p2.y,
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
