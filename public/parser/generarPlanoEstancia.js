// Este archivo depende de que parseOBJ.js se haya ejecutado antes

function generarPlanoEstancia(roomId, divId, callbackAsignar) {
  console.log("🧩 Generando plano para roomId:", roomId, "div destino:", divId);
  // console.log("📦 Geometría disponible:", window.geometriaPorRoom); // Puede ser muy verboso, opcional

  const contenedor = document.getElementById(divId);
  if (!contenedor) {
      console.error("❌ No se encontró el contenedor con id:", divId); // Usar error para problemas críticos
      return;
  }

  const geometria = window.geometriaPorRoom?.[roomId];
  if (!geometria || !geometria.suelo || !geometria.paredes) { // Verificar también la existencia de suelo/paredes
      console.warn(`⚠️ No hay geometría completa (suelo/paredes) para ${roomId} en geometriaPorRoom`);
      contenedor.innerHTML = `<p style='color: #999; padding: 10px;'>No hay datos suficientes para generar el plano de ${roomId}.</p>`;
      return;
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 500 500"); // Coincide con normalize
  svg.setAttribute("width", "100%");
  // Ajustar altura si es necesario, o usar aspect ratio con viewBox
  svg.setAttribute("height", "auto");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet"); // Mejor para responsividad
  svg.style.maxWidth = "500px"; // Limitar tamaño máximo si se desea
  svg.style.display = "block"; // Evitar espacio extra debajo del SVG
  svg.style.margin = "auto"; // Centrar si es necesario


  // Dibujar suelo primero
  if (Array.isArray(geometria.suelo) && geometria.suelo.length > 0) {
      const suelo = document.createElementNS(svgNS, "polygon");
      // --- CORRECCIÓN: Usar p.y en lugar de p.z ---
      const puntos = geometria.suelo.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
      suelo.setAttribute("points", puntos);
      suelo.setAttribute("fill", "#f0f0f0"); // Un gris más claro
      suelo.setAttribute("stroke", "#cccccc"); // Borde más sutil
      suelo.setAttribute("stroke-width", "1"); // Ancho de borde más fino
      suelo.setAttribute("class", "suelo");
      suelo.style.cursor = "pointer";
      suelo.addEventListener("click", () => {
           if (typeof callbackAsignar === 'function') {
               callbackAsignar("floor", roomId);
           } else {
               console.warn("callbackAsignar no es una función válida");
           }
      });
      svg.appendChild(suelo);
  } else {
      console.warn(`Suelo para ${roomId} no es un array válido o está vacío.`);
  }

  // Dibujar paredes
  if (Array.isArray(geometria.paredes)) {
      geometria.paredes.forEach((pared, i) => {
          // --- CORRECCIÓN: Desestructurar y1, y2 en lugar de z1, z2 ---
          const { x1, y1, x2, y2, wallId } = pared;

          // --- CORRECCIÓN: Usar y1, y2 para calcular dy ---
          const dx = x2 - x1;
          const dy = y2 - y1; // Usar y1, y2
          const distancia = Math.sqrt(dx * dx + dy * dy);

          // Descartar líneas muy cortas (puede ser útil si hay vértices duplicados cercanos)
          if (distancia < 0.1) { // Umbral muy pequeño
               // console.log(`Descartando pared ${wallId || i} por ser muy corta: ${distancia.toFixed(3)}`);
               return;
          }

          const linea = document.createElementNS(svgNS, "line");
          // --- CORRECCIÓN: Establecer atributos y1, y2 ---
          linea.setAttribute("x1", x1.toFixed(2));
          linea.setAttribute("y1", y1.toFixed(2)); // Usar y1
          linea.setAttribute("x2", x2.toFixed(2));
          linea.setAttribute("y2", y2.toFixed(2)); // Usar y2

          linea.setAttribute("stroke", "#888888"); // Un gris más oscuro para las paredes
          linea.setAttribute("stroke-width", "3"); // Hacerlas un poco más gruesas
          linea.setAttribute("stroke-linecap", "round"); // Extremos redondeados
          if (wallId) { // Solo añadir data-wall si existe
               linea.setAttribute("data-wall", wallId);
          } else {
               console.warn(`Pared ${i} en ${roomId} no tiene wallId asignado.`);
               linea.setAttribute("stroke", "#ff0000"); // Marcar en rojo paredes sin ID?
          }
          linea.setAttribute("class", "pared");
          linea.style.cursor = "pointer";

          linea.addEventListener("click", (event) => {
              event.stopPropagation(); // Evitar que el click se propague al suelo si se solapan
              if (wallId && typeof callbackAsignar === 'function') {
                  callbackAsignar("wall", wallId);
              } else if (!wallId) {
                  console.warn("Click en pared sin wallId.");
              } else {
                  console.warn("callbackAsignar no es una función válida");
              }
          });
          svg.appendChild(linea);
      });
  } else {
       console.warn(`Paredes para ${roomId} no es un array válido.`);
  }

  contenedor.innerHTML = ""; // Limpiar antes de añadir
  contenedor.appendChild(svg);
  console.log(`✅ Plano SVG para ${roomId} generado en ${divId}.`);
}