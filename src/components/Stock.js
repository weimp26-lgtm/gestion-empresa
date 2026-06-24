import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function Stock() {
  const [compras, setCompras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [filtros, setFiltros] = useState({ nombre: "", nivel: "" });

  useEffect(() => {
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCompras(); unsubVentas(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  // Calcular stock real por producto en base a compras y ventas
  const calcularStock = () => {
    const productos = {};

    // Sumar todo lo comprado
    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) {
        productos[nombre] = {
          nombre,
          comprado: 0,
          vendido: 0,
          costoUnit: 0,
          precioVenta: 0,
          moneda: c.moneda || "ARS",
        };
      }
      productos[nombre].comprado += Number(c.cantidad || 0);
      productos[nombre].costoUnit = Number(c.costoUnit || 0);
      productos[nombre].moneda = c.moneda || "ARS";
    });

    // Restar todo lo vendido
    ventas.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) {
        productos[nombre] = {
          nombre,
          comprado: 0,
          vendido: 0,
          costoUnit: 0,
          precioVenta: 0,
          moneda: "ARS",
        };
      }
      productos[nombre].vendido += Number(v.cantidad || 0);
      productos[nombre].precioVenta = Number(v.precio || 0);
    });

    return Object.values(productos).map((p) => ({
      ...p,
      stockActual: p.comprado - p.vendido,
    }));
  };

  const stockCalculado = calcularStock();

  const stockFiltrado = stockCalculado.filter((s) => {
    if (filtros.nombre && !s.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false;
    if (filtros.nivel === "critico" && s.stockActual > 3) return false;
    if (filtros.nivel === "bajo" && s.stockActual > 6) return false;
    return true;
  });

  // Métricas generales
  const totalProductos = stockCalculado.length;
  const totalUnidades = stockCalculado.reduce((a, s) => a + s.stockActual, 0);
  const valorInvertido = stockCalculado.reduce((a, s) => a + s.stockActual * s.costoUnit, 0);
  const valorVenta = stockCalculado.reduce((a, s) => a + s.stockActual * s.precioVenta, 0);
  const gananciaPotencial = valorVenta - valorInvertido;
  const margenPromedio = valorVenta > 0 ? Math.round((valorVenta - valorInvertido) / valorVenta * 100) : 0;

  return (
    <div className="section">
      <h2 className="section-title">Stock</h2>

      {/* Métricas */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Productos distintos</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{totalProductos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Unidades en stock</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{totalUnidades}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Invertido (costo)</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(valorInvertido)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor de venta</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(valorVenta)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Ganancia potencial</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(gananciaPotencial)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Margen promedio</p>
          <p className="metric-value" style={{ color: margenPromedio >= 20 ? "#1D9E75" : "#BA7517" }}>
            {margenPromedio}%
          </p>
        </div>
      </div>

      {/* Balance resumen */}
      <div className="card" style={{ borderLeft: "3px solid #1D9E75" }}>
        <h3 className="card-title">Balance de stock</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <p style={{ color: "#888", fontSize: "12px", marginBottom: "4px" }}>Invertido en stock actual</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#A32D2D" }}>{fmt(valorInvertido)}</p>
          </div>
          <div>
            <p style={{ color: "#888", fontSize: "12px", marginBottom: "4px" }}>Si vendés todo al precio actual</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#1D9E75" }}>{fmt(valorVenta)}</p>
          </div>
          <div>
            <p style={{ color: "#888", fontSize: "12px", marginBottom: "4px" }}>Ganancia potencial ({margenPromedio}%)</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmt(gananciaPotencial)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="card-title">Filtros</h3>
        <div className="filters">
          <div className="form-group">
            <label>Buscar producto</label>
            <input
              placeholder="Nombre..."
              value={filtros.nombre}
              onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Nivel de stock</label>
            <select value={filtros.nivel} onChange={(e) => setFiltros({ ...filtros, nivel: e.target.value })}>
              <option value="">Todos</option>
              <option value="critico">Crítico (3 o menos)</option>
              <option value="bajo">Bajo (6 o menos)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ nombre: "", nivel: "" })}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Comprado</th>
                <th>Vendido</th>
                <th>Stock actual</th>
                <th>Costo unit.</th>
                <th>Precio venta</th>
                <th>Margen %</th>
                <th>Valor en stock</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltrado.map((s, i) => {
                const margen = s.precioVenta > 0
                  ? Math.round((s.precioVenta - s.costoUnit) / s.precioVenta * 100)
                  : 0;
                const nivel = s.stockActual <= 3 ? "red" : s.stockActual <= 6 ? "amber" : "green";
                return (
                  <tr key={i}>
                    <td><strong>{s.nombre}</strong></td>
                    <td>{s.comprado}</td>
                    <td>{s.vendido}</td>
                    <td>
                      <span className={`badge badge-${nivel}`}>
                        {s.stockActual} uds.
                      </span>
                    </td>
                    <td>{fmt(s.costoUnit)}</td>
                    <td>{fmt(s.precioVenta)}</td>
                    <td>
                      <span style={{ color: margen >= 20 ? "#1D9E75" : "#BA7517", fontWeight: 500 }}>
                        {margen}%
                      </span>
                    </td>
                    <td>{fmt(s.stockActual * s.costoUnit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Stock;