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
  
    function normalize(vertices, width, height, padding = 20) {
      const { minX, minY, maxX, maxY } = getBounds(vertices);
      const scaleX = (width - 2 * padding) / (maxX - minX || 1);
      const scaleY = (height - 2 * padding) / (maxY - minY || 1);
      const scale = Math.min(scaleX, scaleY);
      return vertices.map(({ x, y }) => ({
        x: (x - minX) * scale + padding,
        y: height - ((y - minY) * scale + padding)
      }));
    }
  
    window.parseOBJ = function (textoOBJ) {
      console.log("📄 .OBJ recibido:", textoOBJ.slice(0, 300));
  
      const lines = textoOBJ.split("\n");
      const vertices = [];
      const geometria = {};
      let currentRoom = null;
      let currentWall = null;
  
      lines.forEach(line => {
        if (line.startsWith("v ")) {
          const [, x, y, z] = line.trim().split(/\s+/).map(Number);
          vertices.push({ x, y }); // solo usamos x e y
        } else if (line.startsWith("g ")) {
          const partes = line.trim().split(" ");
          const posibleRoom = partes.find(p => p.startsWith("room"));
          if (posibleRoom) {
            currentRoom = posibleRoom;
            if (!geometria[currentRoom]) {
              geometria[currentRoom] = { paredes: [], suelo: [] };
            }
          }
          currentWall = partes.find(p => p.startsWith("wall")) || null;
        } else if (line.startsWith("f ") && currentRoom) {
            const indices = line.split(" ").slice(1).map(i => parseInt(i.split("/")[0]) - 1);
            const puntos = indices.map(i => vertices[i]);
          
            // --- si es una pared ---
            if (currentWall) {
              // buscar 2 puntos a cota 0
              const puntosSuelo = puntos.filter(p => Math.abs(p.y) < 0.01).map(p => ({ x: p.x, y: p.z }));
          
              if (puntosSuelo.length >= 2) {
                geometria[currentRoom].suelo.push(...puntosSuelo);
          
                // Solo si son dos puntos planos, guardamos como línea
                if (puntosSuelo.length === 2) {
                  geometria[currentRoom].paredes.push({
                    x1: puntosSuelo[0].x,
                    y1: puntosSuelo[0].y,
                    x2: puntosSuelo[1].x,
                    y2: puntosSuelo[1].y,
                    wallId: currentWall
                  });
                }
              }
            }
          }
      });
  
      window.geometriaPorRoom = {};
  
      for (let room in geometria) {
        const { paredes, suelo } = geometria[room];
        const sueloNorm = normalize(suelo, 300, 300);
        const paredesNorm = paredes.map(p => {
          const p1 = normalize([{ x: p.x1, y: p.y1 }], 300, 300)[0];
          const p2 = normalize([{ x: p.x2, y: p.y2 }], 300, 300)[0];
          return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, wallId: p.wallId };
        });
  
        window.geometriaPorRoom[room] = {
          suelo: sueloNorm,
          paredes: paredesNorm
        };
      }
  
      console.log("✅ OBJ parseado correctamente. Rooms encontrados:", Object.keys(window.geometriaPorRoom));
    };
  })();
  