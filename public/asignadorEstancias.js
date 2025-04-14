// Diccionario de colores techo por tipo
const COLORES_TECHO_ESTANCIA = {
    "BAÑO": "d5d5d5",
    "COCINA": "cccccc",
    "PASILLO": "9c9c9c",
    "SALÓN": "e8e8e8",
    "DORMITORIO": "a8a8a8"
  };
  
  // Función para detectar tipo según color
  function detectarTipoEstanciaPorColor(colorHex) {
    if (!colorHex || typeof colorHex !== "string") return "Otro";
    colorHex = colorHex.toLowerCase().replace("#", "");
  
    const coincidencia = Object.entries(COLORES_TECHO_ESTANCIA)
      .find(([tipo, color]) => color === colorHex);
  
    return coincidencia ? coincidencia[0] : "Otro";
  }
  
  // Calcular área de un polígono plano dado un conjunto de vértices
  function calcularAreaSuelo(vertices) {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const [x1, , z1] = vertices[i];
      const [x2, , z2] = vertices[(i + 1) % vertices.length];
      area += (x1 * z2 - x2 * z1);
    }
    return Math.abs(area / 2);
  }
  
  // Función principal
  function detectarEstanciasDesdeOBJ(textoOBJ, textoCSV) {
    const estanciasCSV = parsearCSV(textoCSV);
    const habitacionesOBJ = parsearOBJ(textoOBJ);
  
    const resultado = {};
  
    for (const roomId in habitacionesOBJ) {
        const habitacion = habitacionesOBJ[roomId];
      
        if (!habitacion.color) {
          console.warn("⚠️ Sin color para habitación:", roomId, habitacion);
        }
      
        const mejorMatch = estanciasCSV.reduce((mejor, estancia) => {
          const diffParedes = Math.abs(estancia.paredes - habitacion.paredes);
          const diffArea = Math.abs(estancia.area - habitacion.area);
          const score = diffParedes * 10 + diffArea;
          return !mejor || score < mejor.score ? { ...estancia, score } : mejor;
        }, null);
      
        resultado[roomId] = {
          estancia: mejorMatch?.nombre || roomId,
          tipo: detectarTipoEstanciaPorColor(habitacion.color)
        };
      }
  
    return resultado;
  }
  
  // Parseador del CSV
  function parsearCSV(textoCSV) {
    const lineas = textoCSV.split("\n");
    const indiceInicio = lineas.findIndex(l => l.startsWith("Room name"));
    const lineasDatos = [];
  
    for (let i = indiceInicio + 1; i < lineas.length; i++) {
      const l = lineas[i];
      if (!l.trim() || l.replaceAll(",", "").trim() === "") break;
      lineasDatos.push(l);
    }
  
    return lineasDatos.map(l => {
      const partes = l.split(",");
      return {
        nombre: partes[0].trim(),
        paredes: parseInt(partes[1]),
        area: parseFloat(partes[7])
      };
    });
  }
  
  // Parseador del OBJ
  function parsearOBJ(textoOBJ) {
    const lines = textoOBJ.split("\n");
    const vertices = [];
    const habitaciones = {};
  
    let currentRoom = null;
    let currentGroup = null;
    let currentMaterial = null;
    let floorVertices = [];
  
    for (const line of lines) {
        if (line.startsWith("v ")) {
            const [, x, y, z] = line.trim().split(/\s+/).map(Number);
            vertices.push([x, y, z]);
        }
        
        if (line.startsWith("g ")) {
            const partes = line.trim().split(" ");
            currentGroup = partes[1];
            currentRoom = partes[2];
        }
        
        if (line.startsWith("usemtl ")) {
            currentMaterial = line.split(" ")[1].trim().toLowerCase();
        
            // ⚡️ En ese momento ya sabemos el grupo actual (ceiling)
            if (currentGroup === "ceiling" && currentRoom) {
            if (!habitaciones[currentRoom]) {
                habitaciones[currentRoom] = {
                color: null,
                verticesSuelo: [],
                area: 0,
                paredes: 0
                };
            }
            habitaciones[currentRoom].color = currentMaterial;
            }
        }
        
        if (line.startsWith("f ") && currentRoom) {
            const indices = line.slice(2).trim().split(" ").map(f => {
            const idx = f.split("//")[0];
            return parseInt(idx < 0 ? vertices.length + parseInt(idx) : idx - 1);
            });
        
            if (!habitaciones[currentRoom]) {
            habitaciones[currentRoom] = {
                color: null,
                verticesSuelo: [],
                area: 0,
                paredes: 0
            };
            }
        
            if (currentGroup === "floor") {
            const puntos = indices.map(i => vertices[i]);
            habitaciones[currentRoom].verticesSuelo.push(...puntos);
            }
        
            if (currentGroup?.startsWith("wall")) {
            habitaciones[currentRoom].paredes += 1;
            }
        }
    }
  
    for (const id in habitaciones) {
      const verts = habitaciones[id].verticesSuelo;
      habitaciones[id].area = calcularAreaSuelo(verts);
    }
  
    return habitaciones;
  }
  