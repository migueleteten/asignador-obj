// public/parser/parseOBJ.js

(function () {
    // Utils para normalizar el plano al SVG
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
      const scaleX = (width - 2 * padding) / (maxX - minX);
      const scaleY = (height - 2 * padding) / (maxY - minY);
      const scale = Math.min(scaleX, scaleY);
      return vertices.map(({ x, y }) => ({
        x: (x - minX) * scale + padding,
        y: height - ((y - minY) * scale + padding) // invertir Y para SVG
      }));
    }
  
    // Analiza .obj y llena window.geometriaPorRoom
    window.parseOBJ = function (textoOBJ) {
      const lines = textoOBJ.split("\n");
      const vertices = [];
      const geometria = {};
      let currentRoom = null;
      let currentWall = null;
  
      lines.forEach(line => {
        if (line.startsWith("v ")) {
          const [, x, y, z] = line.split(/\s+/).map(Number);
          vertices.push({ x, y }); // solo XY
        } else if (line.startsWith("g ")) {
            const partes = line.split(" ");
            const posibleRoom = partes.find(p => p.startsWith("room"));
            if (posibleRoom) {
              currentRoom = posibleRoom;
              if (!geometria[currentRoom]) {
                geometria[currentRoom] = { paredes: [], suelo: [] };
              }
            }
            if (line.includes("wall")) {
              currentWall = partes.find(p => p.startsWith("wall"));
            } else {
              currentWall = null;
            }
          } else if (line.startsWith("g wall")) {
          currentWall = line.split(" ")[1];
        } else if (line.startsWith("usemtl ")) {
          // ignorar materiales
        } else if (line.startsWith("f ") && currentRoom) {
          const indices = line.split(" ").slice(1).map(i => parseInt(i.split("/")[0]) - 1);
          const puntos = indices.map(i => vertices[i]);
          if (currentWall) {
            const pared = { ...puntos[0], ...puntos[1], wallId: currentWall };
            geometria[currentRoom].paredes.push({
              x1: puntos[0].x,
              y1: puntos[0].y,
              x2: puntos[1].x,
              y2: puntos[1].y,
              wallId: currentWall
            });
          } else if (indices.length >= 3) {
            geometria[currentRoom].suelo.push(...puntos);
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
  