// public/parser/parseOBJ.js

(function () {
  // --- getBounds, normalize, ordenarPorAngulo (keep as they are) ---
  function getBounds(vertices) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // In the context of ceiling processing, we use x and z
    vertices.forEach(({ x, z }) => {
      if (x < minX) minX = x;
      if (z < minY) minY = z; // Using z for the 'y' bound in 2D projection
      if (x > maxX) maxX = x;
      if (z > maxY) maxY = z; // Using z for the 'y' bound in 2D projection
    });
    // Ensure min/max are numbers, default to 0 if infinite
     minX = isFinite(minX) ? minX : 0;
     minY = isFinite(minY) ? minY : 0;
     maxX = isFinite(maxX) ? maxX : 0;
     maxY = isFinite(maxY) ? maxY : 0;
    return { minX, minY, maxX, maxY };
  }

  function normalize(vertices, width, height, padding = 5) {
    // Use x and z for bounds calculation
    const { minX, minY: minZ, maxX, maxY: maxZ } = getBounds(vertices);

    // Handle cases where max == min (single point or straight line)
    const rangeX = maxX - minX || 1;
    const rangeZ = maxZ - minZ || 1; // Using Z range

    const availableWidth = width - 2 * padding;
    const availableHeight = height - 2 * padding;

    const scaleX = availableWidth / rangeX;
    const scaleY = availableHeight / rangeZ; // Use Z range for Y scaling
    const scale = Math.min(scaleX, scaleY);

    // Recalculate offsets based on the final scale
    const offsetX = (width - (rangeX * scale)) / 2;
    const offsetY = (height - (rangeZ * scale)) / 2; // Use Z range for Y offset

    return vertices.map(({ x, z }) => ({ // Map uses x and z
      // Apply normalization based on original minX/minZ
      // The inversion (width - ..., height - ...) is often for screen coordinates (top-left origin)
      x: (x - minX) * scale + offsetX,
      y: (z - minZ) * scale + offsetY  // Map z to y, apply Z normalization
      // If you need inverted Y for screen coordinates (optional):
      // y: height - ((z - minZ) * scale + offsetY)
    }));
  }

  function ordenarPorAngulo(puntos) {
      if (!puntos || puntos.length < 3) return puntos || []; // Handle null, undefined or insufficient points
      // Use x and z for centroid calculation
      const cx = puntos.reduce((sum, p) => sum + p.x, 0) / puntos.length;
      const cz = puntos.reduce((sum, p) => sum + p.z, 0) / puntos.length; // Use z for centroid calculation
      return puntos.slice().sort((a, b) => {
          // Use x and z for angle calculation
          const angA = Math.atan2(a.z - cz, a.x - cx); // Use z for y-component
          const angB = Math.atan2(b.z - cz, b.x - cx); // Use z for y-component
          return angA - angB;
      });
  }
  // --- end of utility functions ---

  // ***** MODIFIED FUNCTION *****
  // Renamed second parameter for clarity and corrected lookup logic
  function paredesDePunto(puntoNegado, verticesPorPuntoMap) {
    // This point has NEGATED coordinates from the ceiling processing
    // console.log(`\n--- paredesDePunto para punto negado: (${puntoNegado.x}, ${puntoNegado.z}) ---`);
    const walls = new Set();

    // Calculate the ORIGINAL coordinates to use as the key
    // Handle potential -0 issues by adding a small epsilon or checking specifically
    const originalX = (puntoNegado.x === 0) ? 0 : -puntoNegado.x;
    const originalZ = (puntoNegado.z === 0) ? 0 : -puntoNegado.z;

    // Create the key using the calculated ORIGINAL coordinates, matching the format used when populating the map
    const puntoKey = `${originalX.toFixed(5)},${originalZ.toFixed(5)}`;
    // console.log(`   Buscando clave original: ${puntoKey}`); // Debug log

    // Look up using the original coordinate key
    if (verticesPorPuntoMap[puntoKey]) {
      verticesPorPuntoMap[puntoKey].forEach(wall => {
        // console.log(`     Encontrado wall: ${wall}`); // Debug log
        walls.add(wall);
      });
    } else {
        // console.log(`     Clave ${puntoKey} NO encontrada en verticesPorPuntoMap.`); // Debug log
    }

    const wallsArray = Array.from(walls);
    // console.log(`   Paredes encontradas para clave ${puntoKey}: ${wallsArray.length > 0 ? wallsArray.join(', ') : 'Ninguna'}`); // Debug log
    return wallsArray;
  }
  // ***** END OF MODIFIED FUNCTION *****


  window.parseOBJ = function (textoOBJ) {
    console.log("📄 .OBJ recibido:", textoOBJ.slice(0, 300));

    const lines = textoOBJ.split("\n");
    // const vertices = []; // This was unused, can be removed
    const ceilingPorRoom = {};
    const verticesPorPunto = {}; // Map: "originalX,originalZ" -> Set(wallId1, wallId2, ...)
    let currentRoom = null;
    let currentWall = null;
    let parsingCeiling = false;

    lines.forEach(line => {
      line = line.trim(); // Trim whitespace
      if (line.startsWith("g ")) {
        const partes = line.split(/\s+/);
        const room = partes.find(p => /^room\d+$/i.test(p));
        currentRoom = room ? room.toLowerCase() : null;
        const wall = partes.find(p => /^wall\d+$/i.test(p));
        const isCeiling = partes.some(p => p.toLowerCase() === "ceiling"); // More robust check

        if (currentRoom) {
          parsingCeiling = isCeiling;
          if (parsingCeiling && !ceilingPorRoom[currentRoom]) {
            ceilingPorRoom[currentRoom] = [];
          }
          // Reset currentWall if it's a ceiling group or no wall is specified
          currentWall = (!parsingCeiling && wall) ? wall.toLowerCase() : null;
        } else {
          // Reset context if not in a room group
          parsingCeiling = false;
          currentWall = null;
        }
      }
      else if (line.startsWith("v ")) {
        // Make sure we are in a relevant context (room)
        if (!currentRoom) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 4) continue; // Need at least v x y z

        // Parse coordinates, handle potential parsing errors
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);

        if (isNaN(x) || isNaN(y) || isNaN(z)) continue; // Skip if coordinates are not valid numbers

        const vertice = { x: +x.toFixed(5), y: +y.toFixed(5), z: +z.toFixed(5) };

        if (parsingCeiling) {
          ceilingPorRoom[currentRoom].push(vertice);
        } else if (currentWall) { // Only associate with walls, not just any non-ceiling vertex
          // Key uses ORIGINAL X and Z coordinates
          const key = `${vertice.x},${vertice.z}`;
          if (!verticesPorPunto[key]) {
            verticesPorPunto[key] = new Set();
          }
          verticesPorPunto[key].add(currentWall);
        }
      }
    });

    window.geometriaPorRoom = {};

    console.log("\n--- verticesPorPunto (Mapa de Vértices Originales a Paredes) ---");
    // Log the map content for verification
    for (const key in verticesPorPunto) {
      console.log(`  "${key}": {${Array.from(verticesPorPunto[key]).join(', ')}}`);
    }


    console.log("\n--- Procesando Rooms ---");
    for (let room in ceilingPorRoom) {
      console.log(`\n--- Procesando ${room} ---`);
      const verticesCrudos = ceilingPorRoom[room]; // Original {x,y,z} ceiling vertices
      if (!verticesCrudos || verticesCrudos.length === 0) {
        console.log(`   Skipping ${room}: No ceiling vertices found.`);
        continue;
      }

      // 1. Create points with NEGATED X/Z for polygon shape (as before)
      const puntosXZNegados = verticesCrudos.map(v => ({
        x: +(v.x === 0 ? 0 : -v.x).toFixed(5), // Handle -0
        z: +(v.z === 0 ? 0 : -v.z).toFixed(5)  // Handle -0
      }));

      // 2. Filter for unique negated points
      const claves = new Set();
      const puntosUnicosNegados = puntosXZNegados.filter(p => {
        const clave = `${p.x},${p.z}`;
        if (claves.has(clave)) return false;
        claves.add(clave);
        return true;
      });

      if (puntosUnicosNegados.length < 3) {
          console.log(`   Skipping ${room}: Not enough unique ceiling points (${puntosUnicosNegados.length}) for a polygon.`);
          continue;
      }

      // 3. Sort unique negated points by angle
      const ordenadosNegados = ordenarPorAngulo(puntosUnicosNegados);

      // 4. Create segments (tramos) from the sorted NEGATED points
      const tramos = [];
      for (let i = 0; i < ordenadosNegados.length; i++) {
        const a = ordenadosNegados[i];
        const b = ordenadosNegados[(i + 1) % ordenadosNegados.length];
        tramos.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z });
      }
      console.log(`   ${room}: ${ordenadosNegados.length} puntos únicos de techo (negados), ${tramos.length} tramos creados.`);

      // 5. Find wallId for each tramo using the `paredesDePunto` function (which now handles the coordinate conversion)
      const paredesConId = tramos.map(tramo => {
        // Pass the NEGATED points from the tramo and the map keyed by ORIGINAL coordinates
        const wallsP1 = paredesDePunto({ x: tramo.x1, z: tramo.z1 }, verticesPorPunto);
        const wallsP2 = paredesDePunto({ x: tramo.x2, z: tramo.z2 }, verticesPorPunto);

        // Find walls common to both endpoints of the segment
        const comunes = wallsP1.filter(w => wallsP2.includes(w));

        // Log details for debugging wall assignment
        // console.log(`    Tramo (${tramo.x1}, ${tramo.z1}) -> (${tramo.x2}, ${tramo.z2}): Walls P1=[${wallsP1.join(',')}] Walls P2=[${wallsP2.join(',')}] Comunes=[${comunes.join(',')}]`);

        // Assign the first common wall found, or null if none
        const assignedWallId = comunes[0] || null;
        if (!assignedWallId) {
             console.warn(`      ¡Advertencia! No se encontró wall común para el tramo (${tramo.x1}, ${tramo.z1}) -> (${tramo.x2}, ${tramo.z2})`);
        }

        return { ...tramo, wallId: assignedWallId };
      });

      // 6. Normalize the geometry FOR DRAWING using the NEGATED points
      // Normalize the floor polygon points (sorted unique negated points)
      const sueloNorm = normalize(ordenadosNegados, 500, 500); // Use 'z' for y-axis internally in normalize

      // Prepare points for wall normalization (use unique negated points directly)
      // The order in 'paredesConId' matches the order in 'ordenadosNegados'
      const extremosParaNormalizar = ordenadosNegados.map(p => ({ x: p.x, z: p.z }));
      const extremosNorm = normalize(extremosParaNormalizar, 500, 500); // Normalize wall endpoints

      // Map normalized endpoints back to walls, preserving wallId
      const paredesNorm = [];
      for (let i = 0; i < paredesConId.length; i++) {
          const paredOriginal = paredesConId[i]; // Contains original tramo coords and wallId
          const p1Norm = extremosNorm[i]; // Normalized point corresponding to paredOriginal.(x1, z1)
          const p2Norm = extremosNorm[(i + 1) % extremosNorm.length]; // Normalized point corresponding to paredOriginal.(x2, z2)

          // Use the normalized 'y' which corresponds to 'z'
          paredesNorm.push({
              x1: p1Norm.x, z1: p1Norm.y, // Store normalized z in z1
              x2: p2Norm.x, z2: p2Norm.y, // Store normalized z in z2
              wallId: paredOriginal.wallId
          });
      }

      console.log(`   ${room}: Suelo Normalizado (${sueloNorm.length} puntos), Paredes Normalizadas (${paredesNorm.length} tramos con IDs)`);
      // Debug: Log first few normalized points/walls
       if (sueloNorm.length > 0) console.log(`      Ej. Suelo Norm: (${sueloNorm[0].x.toFixed(2)}, ${sueloNorm[0].y.toFixed(2)})`);
       if (paredesNorm.length > 0) console.log(`      Ej. Pared Norm: (${paredesNorm[0].x1.toFixed(2)}, ${paredesNorm[0].z1.toFixed(2)}) -> (${paredesNorm[0].x2.toFixed(2)}, ${paredesNorm[0].z2.toFixed(2)}) ID: ${paredesNorm[0].wallId}`);


      // Store the final normalized data
      window.geometriaPorRoom[room] = {
        suelo: sueloNorm, // Use normalized points {x, y} where y is derived from z
        paredes: paredesNorm // Use normalized segments {x1, z1, x2, z2, wallId} where z1/z2 are derived from z
      };
    }

    console.log("✅ OBJ parseado y ceiling interpretado. Rooms procesados:", Object.keys(window.geometriaPorRoom));
     // Log final structure for a sample room if available
     const firstRoom = Object.keys(window.geometriaPorRoom)[0];
     if (firstRoom) {
         console.log(`\n--- Geometría Final para ${firstRoom} ---`);
         console.log("  Suelo (primeros 5 puntos):", window.geometriaPorRoom[firstRoom].suelo.slice(0, 5));
         console.log("  Paredes (primeros 5 tramos):", window.geometriaPorRoom[firstRoom].paredes.slice(0, 5));
     }

  };
})();
