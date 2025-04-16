// public/parser/parseOBJ.js
(function () {

  // Helper function to get bounding box of vertices (using x, y)
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

  // Helper function to normalize vertices to fit within width/height with padding
  // Also handles Y-axis inversion for screen coordinates and applies transformations
  function normalize(vertices, width, height, padding = 20) {
    if (!vertices || vertices.length === 0) {
        console.warn("Normalize called with empty or invalid vertices array.");
        return [];
    }
    const { minX, minY, maxX, maxY } = getBounds(vertices);
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const effectiveRangeX = rangeX < 1e-6 ? 1 : rangeX;
    const effectiveRangeY = rangeY < 1e-6 ? 1 : rangeY;
    const availableWidth = width - 2 * padding;
    const availableHeight = height - 2 * padding;
    const scaleX = availableWidth > 0 ? availableWidth / effectiveRangeX : 1;
    const scaleY = availableHeight > 0 ? availableHeight / effectiveRangeY : 1;
    const scale = Math.max(1e-6, Math.min(scaleX, scaleY));
    const offsetX = padding + (availableWidth - rangeX * scale) / 2;
    const offsetY = padding + (availableHeight - rangeY * scale) / 2;
    return vertices.map(({ x, y }) => ({
      x: (x - minX) * scale + offsetX,
      y: height - ((y - minY) * scale + offsetY)
    }));
  }


  // Helper function to order points by angle around their centroid
  function ordenarPorAngulo(puntos) {
    if (!puntos || puntos.length < 3) return puntos;
    let sumX = 0, sumY = 0;
    puntos.forEach(p => {
        sumX += p.x;
        sumY += p.y;
    });
    const cx = sumX / puntos.length;
    const cy = sumY / puntos.length;
    return puntos.slice().sort((a, b) => {
      const angA = Math.atan2(a.y - cy, a.x - cx);
      const angB = Math.atan2(b.y - cy, b.x - cx);
      return angA - angB;
    });
  }

  // --- Main Parsing Function ---
  window.parseOBJ = function (textoOBJ, width = 500, height = 500) {
    console.log("📄 .OBJ recibido (primeros 300 chars):", textoOBJ.slice(0, 300));

    const lines = textoOBJ.split("\n");
    // MODIFICADO: ceilingVerticesPorRoom almacenará vértices ORIGINALES {x,y,z} para cálculo de altura
    const ceilingVerticesPorRoom = {};
    const verticesPorPuntoOriginal = {}; // Maps original "x,z" coords (fixed) to Set<wallId>
    const precisionFactor = 10000;

    let currentRoom = null;
    let currentWall = null;
    let isParsingCeiling = false;

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
        return; // Skip empty lines and comments
      }

      if (trimmedLine.startsWith("g ")) {
        const partes = trimmedLine.split(/\s+/);
        currentRoom = null; currentWall = null; isParsingCeiling = false;
        partes.forEach(p => {
          const pLower = p.toLowerCase();
          if (/^room\d+$/.test(pLower)) currentRoom = pLower;
          else if (/^wall\d+$/.test(pLower)) currentWall = pLower;
          else if (pLower === 'ceiling') isParsingCeiling = true;
        });
        if (currentRoom && isParsingCeiling && !ceilingVerticesPorRoom[currentRoom]) {
          ceilingVerticesPorRoom[currentRoom] = [];
        }
      } else if (trimmedLine.startsWith("v ")) {
        try {
            const [, xStr, yStr, zStr] = trimmedLine.split(/\s+/);
            const x = parseFloat(xStr);
            const y = parseFloat(yStr);
            const z = parseFloat(zStr);
            if (isNaN(x) || isNaN(y) || isNaN(z)) return;

            // MODIFICADO: Guardar vértice ORIGINAL {x,y,z} para el techo
            if (isParsingCeiling && currentRoom) {
              ceilingVerticesPorRoom[currentRoom].push({ x: x, y: y, z: z });
            }

            // Usar coords fijas para el lookup de paredes (como antes)
            if (currentWall) {
                const xFixed = Math.round(x * precisionFactor) / precisionFactor;
                const zFixed = Math.round(z * precisionFactor) / precisionFactor;
                const key = `${xFixed},${zFixed}`;
                if (!verticesPorPuntoOriginal[key]) verticesPorPuntoOriginal[key] = new Set();
                verticesPorPuntoOriginal[key].add(currentWall);
            }
        } catch (e) {
           // console.error("Error parsing vertex line:", trimmedLine, e);
        }
      }
    });

    // console.log("🔍 Vertices por punto original:", verticesPorPuntoOriginal); // Mantener debug log si quieres

    // --- Process Geometry Per Room ---
    window.geometriaPorRoom = {}; // Resetear geometría final

    for (const room in ceilingVerticesPorRoom) {
      // MODIFICADO: Ahora son los vértices originales {x,y,z} del techo
      const verticesCrudosTecho = ceilingVerticesPorRoom[room];
      if (verticesCrudosTecho.length === 0) {
          console.warn(`Room ${room} tiene grupo ceiling pero no vertices 'v'. Saltando.`);
          continue;
      }

      // --- NUEVO: Calcular Altura de Estancia ---
      let minYTecho = Infinity, maxYTecho = -Infinity;
      verticesCrudosTecho.forEach(v => {
          // Usamos la coordenada Y original del vértice del techo
          if (v.y < minYTecho) minYTecho = v.y;
          if (v.y > maxYTecho) maxYTecho = v.y;
      });
      // Asumimos que la altura es el valor Y máximo del techo.
      const alturaEstancia = maxYTecho;
      console.log(`Habitación ${room}: Altura Techo estimada (max Y) = ${alturaEstancia.toFixed(4)}`);


      // 1. & 6. Obtener puntos XZ para el plano 2D y aplicar transformación (-x, -z)
      // Se sigue usando la lógica de transformar -x,-z para la disposición 2D
      const puntosXZTransformados = verticesCrudosTecho.map(v => ({
        x: -v.x,
        y: -v.z
      }));

      // 2. Filtrar por valores únicos (usando los puntos transformados)
      const clavesUnicas = new Set();
      const puntosUnicos = puntosXZTransformados.filter(p => {
        const clave = `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
        if (clavesUnicas.has(clave)) return false;
        clavesUnicas.add(clave);
        return true;
      });

       if (puntosUnicos.length < 3) {
           console.warn(`Room ${room} tiene menos de 3 puntos únicos en el techo (${puntosUnicos.length}). Saltando.`);
           continue;
       }

      // 3. Ordenar por ángulo ATAN2 (usando los puntos transformados)
      const puntosOrdenados = ordenarPorAngulo(puntosUnicos);

      // 4. & 5. Crear tramos, asignar paredes Y CALCULAR LONGITUD ORIGINAL
      const tramos = [];
      for (let i = 0; i < puntosOrdenados.length; i++) {
        const p1_t = puntosOrdenados[i]; // Punto transformado 1
        const p2_t = puntosOrdenados[(i + 1) % puntosOrdenados.length]; // Punto transformado 2

        // Revertir transformación para obtener coordenadas originales X, Z
        const originalX1 = -p1_t.x;
        const originalZ1 = -p1_t.y;
        const originalX2 = -p2_t.x;
        const originalZ2 = -p2_t.y;

        // --- NUEVO: Calcular Longitud Original ---
        const dx_orig = originalX2 - origX1;
        const dz_orig = originalZ2 - origZ1;
        const longitudOriginal = Math.sqrt(dx_orig * dx_orig + dz_orig * dz_orig);

        // --- Lógica existente para asignar WallId (usando claves redondeadas) ---
        const keyP1 = `${Math.round(originalX1 * precisionFactor) / precisionFactor},${Math.round(originalZ1 * precisionFactor) / precisionFactor}`;
        const keyP2 = `${Math.round(originalX2 * precisionFactor) / precisionFactor},${Math.round(originalZ2 * precisionFactor) / precisionFactor}`;
        const wallsP1 = verticesPorPuntoOriginal[keyP1] || new Set();
        const wallsP2 = verticesPorPuntoOriginal[keyP2] || new Set();
        const comunes = [...wallsP1].filter(w => wallsP2.has(w));
        const wallId = comunes.length > 0 ? comunes[0] : null;

        // MODIFICADO: Almacenar tramo con coords transformadas + wallId + longitudOriginal
        tramos.push({
          x1_t: p1_t.x, y1_t: p1_t.y, // Coords transformadas
          x2_t: p2_t.x, y2_t: p2_t.y, // Coords transformadas
          wallId: wallId,
          longitudOriginal: +longitudOriginal.toFixed(4) // Guardar longitud original
        });
      }

      // 7. Normalización (usando puntos transformados)
      const sueloNormalizado = normalize(puntosOrdenados, width, height);

      const puntosParedes = tramos.flatMap(t => [{ x: t.x1_t, y: t.y1_t }, { x: t.x2_t, y: t.y2_t }]);
      const extremosNormalizados = normalize(puntosParedes, width, height);

       if (!extremosNormalizados || extremosNormalizados.length !== tramos.length * 2) {
            console.error(`Error en la normalización de paredes para room ${room}.`);
            window.geometriaPorRoom[room] = {
                 suelo: sueloNormalizado || [],
                 paredes: [],
                 alturaTecho: +alturaEstancia.toFixed(4) // Guardar altura aunque fallen paredes
            };
            continue;
       }

      // Reconstruimos los tramos (paredes) con las coordenadas normalizadas
      // MODIFICADO: Añadir longitudOriginal al objeto final de la pared
      const paredesNormalizadas = [];
      for (let i = 0; i < tramos.length; i++) {
        const p1Norm = extremosNormalizados[i * 2];
        const p2Norm = extremosNormalizados[i * 2 + 1];
        paredesNormalizadas.push({
          x1: p1Norm.x, y1: p1Norm.y, // Coords Normalizadas para SVG
          x2: p2Norm.x, y2: p2Norm.y, // Coords Normalizadas para SVG
          wallId: tramos[i].wallId,
          longitudOriginal: tramos[i].longitudOriginal // <-- AÑADIDO
        });
      }

      // MODIFICADO: Almacenar resultado final incluyendo alturaTecho
      window.geometriaPorRoom[room] = {
        suelo: sueloNormalizado,
        paredes: paredesNormalizadas, // Ahora incluye longitudOriginal
        alturaTecho: +alturaEstancia.toFixed(4) // <-- AÑADIDO
      };
    } // Fin del bucle por habitación

    console.log("✅ OBJ parseado y geometría interpretada (con altura/longitud). Rooms:", Object.keys(window.geometriaPorRoom));
    // console.log(" Geometría final:", window.geometriaPorRoom); // Log detallado opcional
  }; // Fin window.parseOBJ

})(); // Fin IIFE