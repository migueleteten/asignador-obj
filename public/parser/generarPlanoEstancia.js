// Este archivo depende de que parseOBJ.js se haya ejecutado antes

function generarPlanoEstancia(roomId, contenedor, callbackAsignar) {
    const geometria = window.geometriaPorRoom?.[roomId];
    if (!geometria) {
      contenedor.innerHTML = "<p style='color: #999;'>No hay plano para esta estancia.</p>";
      return;
    }
  
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 500 500");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "300");
  
    // Dibujar suelo primero
    if (Array.isArray(geometria.suelo)) {
      const suelo = document.createElementNS(svgNS, "polygon");
      const puntos = geometria.suelo.map(p => `${p.x},${p.y}`).join(" ");
      suelo.setAttribute("points", puntos);
      suelo.setAttribute("fill", "#eee");
      suelo.setAttribute("stroke", "#ccc");
      suelo.setAttribute("stroke-width", "1");
      suelo.style.cursor = "pointer";
      suelo.addEventListener("click", () => callbackAsignar("floor", roomId));
      svg.appendChild(suelo);
    }
  
    // Dibujar paredes
    if (Array.isArray(geometria.paredes)) {
      geometria.paredes.forEach((pared, i) => {
        const { x1, y1, x2, y2, wallId } = pared;
        const linea = document.createElementNS(svgNS, "line");
        linea.setAttribute("x1", x1);
        linea.setAttribute("y1", y1);
        linea.setAttribute("x2", x2);
        linea.setAttribute("y2", y2);
        linea.setAttribute("stroke", "#aaa");
        linea.setAttribute("stroke-width", "4");
        linea.setAttribute("data-wall", wallId);
        linea.style.cursor = "pointer";
  
        linea.addEventListener("click", () => callbackAsignar("wall", wallId));
        svg.appendChild(linea);
      });
    }
  
    contenedor.innerHTML = "";
    contenedor.appendChild(svg);
  }
  