// ***********************************************
// asignadorEstancias.js
// ***********************************************

// Diccionario de colores techo por tipo (en mayúsculas para facilitar la comparación)
const COLORES_TECHO_ESTANCIA = {
    "BAÑO": "d5d5d5",
    "COCINA": "cccccc",
    "PASILLO": "9c9c9c",
    "SALÓN": "e8e8e8",
    "DORMITORIO": "a8a8a8"
  };
  
  // Función para detectar el tipo de estancia según el color (comprobada y con logs)
  function detectarTipoEstanciaPorColor(colorHex) {
    if (!colorHex || typeof colorHex !== "string") {
      console.warn("detectarTipoEstanciaPorColor: colorHex inválido:", colorHex);
      return "Otro";
    }
    const original = colorHex;
    colorHex = colorHex.toLowerCase().replace("#", "");
    console.log(`detectarTipoEstanciaPorColor: comparando '${original}' formateado como '${colorHex}'`);
  
    const coincidencia = Object.entries(COLORES_TECHO_ESTANCIA)
      .find(([tipo, color]) => color === colorHex);
  
    if (coincidencia) {
      console.log("detectarTipoEstanciaPorColor: coincidencia encontrada:", coincidencia[0]);
      return coincidencia[0];
    } else {
      console.warn("detectarTipoEstanciaPorColor: No se encontró coincidencia para:", colorHex);
      return "Otro";
    }
  }
  
  // Función para preparar el CSV: convierte el texto CSV en un array de objetos {nombre, paredes, area}
  // Los valores se extraen de:
  //  - Columna 0: Room name
  //  - Columna 1: Walls (se parsea a entero)
  //  - Columna 7: Area [m²] (se parsea a float)
  function prepararEstanciasDesdeCSV(textoCSV) {
    console.log("prepararEstanciasDesdeCSV: iniciando parsing del CSV...");
    if (typeof textoCSV !== "string") {
      console.error("prepararEstanciasDesdeCSV: textoCSV no es string:", textoCSV);
      return [];
    }
    
    const lineas = textoCSV.split("\n");
    const indiceEncabezado = lineas.findIndex(l => l.startsWith("Room name"));
    if (indiceEncabezado < 0) {
      console.error("prepararEstanciasDesdeCSV: No se encontró línea de encabezado 'Room name'");
      return [];
    }
    console.log("prepararEstanciasDesdeCSV: encabezado encontrado en línea", indiceEncabezado);
    
    const estancias = [];
    for (let j = indiceEncabezado + 1; j < lineas.length; j++) {
      const linea = lineas[j];
      if (!linea.trim() || linea.replaceAll(",", "").trim() === "") break;
      const partes = linea.split(",");
      const nombre = partes[0]?.trim();
      const paredes = parseInt(partes[1]?.trim());
      const area = parseFloat(partes[7]?.trim());
      if (!nombre || isNaN(paredes) || isNaN(area)) {
        console.warn(`prepararEstanciasDesdeCSV: línea inválida en ${j}:`, linea);
        continue;
      }
      estancias.push({ nombre, paredes, area });
    }
    console.log("prepararEstanciasDesdeCSV: estancias preparadas:", estancias);
    return estancias;
  }
  
  // Función para calcular el área de un polígono plano dado un conjunto de vértices (considerando solo x y z)
  function calcularAreaSuelo(vertices) {
    if (!vertices || vertices.length < 3) {
      console.warn("calcularAreaSuelo: no hay suficientes vértices para calcular el área.", vertices);
      return 0;
    }
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const [x1, , z1] = vertices[i];
      const [x2, , z2] = vertices[(i + 1) % vertices.length];
      area += (x1 * z2 - x2 * z1);
    }
    const areaCalculada = Math.abs(area / 2);
    console.log("calcularAreaSuelo: área calculada =", areaCalculada);
    return areaCalculada;
  }
  
  // Función principal para detectar las estancias usando el OBJ y el array de estancias CSV
  // Recibe: textoOBJ (string) y estanciasCSV (array de objetos {nombre, paredes, area})
  // Devuelve un objeto con pares roomId: {estancia, tipo}
  function detectarEstanciasDesdeOBJ(textoOBJ, estanciasCSV) {
    console.log("detectarEstanciasDesdeOBJ: iniciando con OBJ y CSV preparados");
    const habitacionesOBJ = parsearOBJ(textoOBJ);
    console.log("detectarEstanciasDesdeOBJ: habitaciones parseadas:", habitacionesOBJ);
    const resultado = {};
  
    for (const roomId in habitacionesOBJ) {
      const habitacion = habitacionesOBJ[roomId];
  
      // Filtrar habitaciones que no sean válidas
      if (!habitacion.color || habitacion.paredes === 0 || habitacion.verticesSuelo.length === 0) {
        console.warn("detectarEstanciasDesdeOBJ: Ignorando habitación inválida:", roomId, habitacion);
        continue;
      }
  
      // Buscar el mejor match en estanciasCSV usando diferencias en paredes y área
      const mejorMatch = estanciasCSV.reduce((mejor, estancia) => {
        const diffParedes = Math.abs(estancia.paredes - habitacion.paredes);
        const diffArea = Math.abs(estancia.area - habitacion.area);
        const score = diffParedes * 10 + diffArea;
        return (!mejor || score < mejor.score) ? { ...estancia, score } : mejor;
      }, null);
  
      if (!mejorMatch) {
        console.warn(`detectarEstanciasDesdeOBJ: No se encontró match para ${roomId}`);
      }
      resultado[roomId] = {
        estancia: mejorMatch?.nombre || roomId,
        tipo: detectarTipoEstanciaPorColor(habitacion.color)
      };
    }
  
    console.log("detectarEstanciasDesdeOBJ: resultado final:", resultado);
    return resultado;
  }
  
  // Parseador del OBJ: convierte el texto del OBJ en un objeto con las habitaciones
  // Cada habitación (key = roomId) tendrá: { color, verticesSuelo, area, paredes }
  function parsearOBJ(textoOBJ) {
    console.log("parsearOBJ: iniciando parsing del OBJ...");
    const lines = textoOBJ.split("\n");
    const vertices = [];
    const habitaciones = {};
  
    let currentRoom = null;
    let currentGroup = null;
    let currentMaterial = null;
  
    // Procesar cada línea del OBJ
    for (const line of lines) {
      if (line.startsWith("v ")) {
        const partes = line.trim().split(/\s+/);
        // Parsea x, y, z y añade a la lista de vértices
        const [ , x, y, z ] = partes.map(Number);
        vertices.push([x, y, z]);
      }
      
      if (line.startsWith("g ")) {
        const partes = line.trim().split(" ");
        currentGroup = partes[1];
        currentRoom = partes[2];
        // Asegurarse de inicializar la habitación si aún no está creada
        if (currentRoom && !habitaciones[currentRoom]) {
          habitaciones[currentRoom] = {
            color: null,
            verticesSuelo: [],
            area: 0,
            paredes: 0
          };
        }
      }
      
      if (line.startsWith("usemtl ")) {
        currentMaterial = line.split(" ")[1].trim().toLowerCase();
        // Si estamos en un grupo de techo ("ceiling") y se conoce currentRoom, asignar el color
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
          console.log(`parsearOBJ: Asignado color '${currentMaterial}' a habitación '${currentRoom}' en grupo 'ceiling'`);
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
          console.log(`parsearOBJ: Agregados ${puntos.length} puntos de suelo a '${currentRoom}'`);
        }
        
        if (currentGroup && currentGroup.startsWith("wall")) {
          habitaciones[currentRoom].paredes += 1;
        }
      }
    }
    
    // Calcular área de suelo para cada habitación
    for (const id in habitaciones) {
      const verts = habitaciones[id].verticesSuelo;
      habitaciones[id].area = calcularAreaSuelo(verts);
    }
    console.log("parsearOBJ: habitaciones finales:", habitaciones);
    return habitaciones;
  }
  
  // ***********************************************
  // FIN DE asignadorEstancias.js
  // ***********************************************  