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
        y: (y - minY) * scale + padding // <<<<<< AQUÍ SE HACE LA INVERSIÓN
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
      const geometria = {};
      let currentRoom = null;
      let currentWall = null;
  
      lines.forEach(line => {
        // VÉRTICES
        if (line.startsWith("v ")) {
          const [, x, y, z] = line.trim().split(/\s+/).map(Number);
          vertices.push({ x, y, z });
        }
  
        // GRUPOS (g wallXX roomXX)
        else if (line.startsWith("g ")) {
          const partes = line.trim().split(/\s+/);
          const room = partes.find(p => /^room\d+$/i.test(p));
          currentRoom = room ? room.toLowerCase() : null;
  
          const wall = partes.find(p => /^wall\d+$/i.test(p));
          currentWall = wall ? wall.toLowerCase() : null;
  
          if (currentRoom && !geometria[currentRoom]) {
            geometria[currentRoom] = { paredes: [], suelo: [] };
          }
        }
  
        // CARAS
        else if (line.startsWith("f ")) {
            console.log("▶️ Procesando cara para room:", currentRoom, "wall:", currentWall);
          
            const indices = line.split(" ").slice(1).map(i => parseInt(i.split("/")[0]) - 1);
            const puntos = indices.map(i => vertices[i >= 0 ? i : vertices.length + i]);
          
            console.log("   - Índices:", indices);
            console.log("   - Puntos:", puntos.map(p => p ? `${p.x},${p.y},${p.z}` : "❌ nulo"));
          
            // Solo aceptamos caras de paredes con room y wall definidos
            if (currentRoom && currentWall) {
                const proyectados = puntos
                .filter(p => p && typeof p.x === "number" && typeof p.z === "number")
                .map(p => ({ x: p.x, y: p.z }));
            
                console.log("   - Puntos proyectados (XZ):", proyectados);
            
                // Añadimos líneas visibles si hay exactamente 2 puntos proyectables
                console.log("💥 Cara proyectada:", proyectados.length, proyectados);
                if (proyectados.length >= 2) {
                    for (let i = 0; i < proyectados.length; i++) {
                      const a = proyectados[i];
                      const b = proyectados[(i + 1) % proyectados.length]; // cierra el ciclo
                      if (Math.hypot(a.x - b.x, a.y - b.y) > 0.1) {
                        geometria[currentRoom].paredes.push({
                            x1: a.x,
                            y1: a.y,
                            x2: b.x,
                            y2: b.y,
                            wallId: currentWall
                        });
                      }
                    }
                    console.log(`✅ ${proyectados.length} segmentos añadidos a room ${currentRoom}`);
                  }
            
                // En cualquier caso, incluimos los puntos en el contorno de suelo
                proyectados.forEach(p => {
                    const yaExiste = geometria[currentRoom].suelo.some(
                      q => Math.abs(q.x - p.x) < 0.001 && Math.abs(q.y - p.y) < 0.001
                    );
                    if (!yaExiste) {
                      geometria[currentRoom].suelo.push(p);
                    }
                  });
            } else {
                console.warn("⚠️ Saltando cara sin room o sin wall definido.");
            }  
          }                 
      });
  
    // NORMALIZACIÓN FINAL
    window.geometriaPorRoom = {};

    for (let room in geometria) {
    const { paredes, suelo } = geometria[room];

    // 1. Filtrar suelo y ordenar
    const sueloFiltrado = suelo.filter(p => p && typeof p.x === "number" && typeof p.y === "number");
    const sueloOrdenado = ordenarPorAngulo(sueloFiltrado);
    const sueloNorm = normalize(sueloOrdenado, 300, 300);

    // 2. Eliminar duplicados e invertidos en paredes
    const paredKey = (p) => {
        const a = `${p.x1.toFixed(3)},${p.y1.toFixed(3)}`;
        const b = `${p.x2.toFixed(3)},${p.y2.toFixed(3)}`;
        return a < b ? `${a}_${b}` : `${b}_${a}`;
    };

    const clavesVistas = new Set();
    const paredesUnicas = [];

    for (const p of paredes) {
        const clave = paredKey(p);
        if (!clavesVistas.has(clave)) {
        clavesVistas.add(clave);
        paredesUnicas.push(p);
        }
    }

    // 3. Normalizar extremos únicos
    const todosLosExtremos = paredesUnicas.flatMap(p => [
        { x: p.x1, y: p.y1 },
        { x: p.x2, y: p.y2 }
    ]);

    const extremosNormalizados = normalize(todosLosExtremos, 300, 300);

    // 4. Reensamblar con coordenadas normalizadas
    let i = 0;
    const paredesNorm = paredesUnicas.map(p => {
        const p1 = extremosNormalizados[i++];
        const p2 = extremosNormalizados[i++];
        return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, wallId: p.wallId };
    });

    // 5. Guardar resultado limpio
    window.geometriaPorRoom[room] = {
        suelo: sueloNorm,
        paredes: paredesNorm
    };
    }

    console.log("✅ OBJ parseado correctamente. Rooms encontrados:", Object.keys(window.geometriaPorRoom));
    };
  })();
  