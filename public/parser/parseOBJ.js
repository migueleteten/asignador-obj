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
    return vertices.map(({ x, y }) => ({
      x: (x - minX) * scale + padding,
      y: (y - minY) * scale + padding
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
    const wallsPorRoom = {};
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
          if (!parsingCeiling && currentRoom && wall) {
            currentWall = wall.toLowerCase();
            if (!wallsPorRoom[currentRoom]) wallsPorRoom[currentRoom] = [];
          }
        }
      }
      else if (line.startsWith("v ")) {
        const [, x, y, z] = line.trim().split(/\s+/).map(Number);
        const vertice = { x: x, y: y, z: z };
        if (parsingCeiling && currentRoom) ceilingPorRoom[currentRoom].push(vertice);
        else vertices.push(vertice); // solo walls
      }
    });

    // Identificar tramos del ceiling únicos por (x,z)
    window.geometriaPorRoom = {};

    for (let room in ceilingPorRoom) {
      const verticesCrudos = ceilingPorRoom[room];
      const puntosXZ = verticesCrudos.map(v => ({ x: +v.x.toFixed(5), y: +v.z.toFixed(5) }));

      // Deduplicar puntos únicos
      const claves = new Set();
      const puntosUnicos = puntosXZ.filter(p => {
        const clave = `${p.x},${p.y}`;
        if (claves.has(clave)) return false;
        claves.add(clave);
        return true;
      });

      // Centroide y orden por ángulo
      const ordenados = ordenarPorAngulo(puntosUnicos);

      // Simetría en eje X y giro 180
      const simetrizados = ordenados.map(p => ({ x: -p.x, y: -p.y }));

      // Crear tramos (cerrado)
      const tramos = [];
      for (let i = 0; i < simetrizados.length; i++) {
        const a = simetrizados[i];
        const b = simetrizados[(i + 1) % simetrizados.length];
        tramos.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      }

      // Buscar wallId
      const walls = vertices.filter(v => typeof v.x === "number" && typeof v.z === "number");
      const paredes = [];

      for (const tramo of tramos) {
        const pared = {
          x1: tramo.x1,
          y1: tramo.y1,
          x2: tramo.x2,
          y2: tramo.y2,
          wallId: null
        };
        paredes.push(pared);
      }

      const sueloNorm = normalize(simetrizados, 300, 300);

      const todosExtremos = paredes.flatMap(p => [
        { x: p.x1, y: p.y1 },
        { x: p.x2, y: p.y2 }
      ]);
      const extremosNorm = normalize(todosExtremos, 300, 300);
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
  