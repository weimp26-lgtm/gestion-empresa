import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function Dashboard() {
  const [ventas, setVentas] = useState([]);
  const [stock, setStock] = useState([]);
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubStock = onSnapshot(collection(db, "stock"), (snap) => {
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubStock(); unsubCompras(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  // Ventas reales — sin estafas
  const ventasReales = ventas.filter(v => !v.estafa);

  const totalVentas = ventasReales.reduce((a, v) => a + (v.total || 0), 0);
  const cobrado = ventasReales.filter(v => v.pago === "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendCobro = ventasReales.filter(v => v.pago !== "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendEntrega = ventasReales.filter(v => v.entrega !== "entregado").length;
  const deudaProv = compras.filter(c => c.pago === "pendiente").reduce((a, c) => a + (c.total || 0), 0);

  // Stock calculado desde compras y ventas
  const calcularStock = () => {
    const productos = {};
    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0, costo: 0 };
      productos[nombre].comprado += Number(c.cantidad || 0);
      productos[nombre].costo = Number(c.costoUnit || 0);
    });
    ventas.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0, costo: 0 };
      productos[nombre].vendido += Number(v.cantidad || 0);
    });
    return Object.values(productos).map(p => ({
      ...p,
      stockActual: p.comprado - p.vendido,
    }));
  };

  const stockCalculado = calcularStock();
  const stockVal = stockCalculado.reduce((a, s) => a + s.stockActual * s.costo, 0);
  const stockCritico = stockCalculado.filter(s => s.stockActual <= 3);

  const metrics = [
    { label: "Ventas totales", value: fmt(totalVentas), color: "#185FA5" },
    { label: "Cobrado", value: fmt(cobrado), color: "#1D9E75" },
    { label: "Por cobrar", value: fmt(pendCobro), color: "#BA7517" },
    { label: "Entregas pendientes", value: pendEntrega, color: pendEntrega > 3 ? "#A32D2D" : "#BA7517" },
    { label: "Deuda proveedores", value: fmt(deudaProv), color: "#A32D2D" },
    { label: "Valor en stock", value: fmt(stockVal), color: "#185FA5" },
  ];

  // Solo ventas reales con entrega pendiente
  const pendientesEntrega = ventasReales.filter(v => v.entrega !== "entregado");

  // Solo ventas reales con cobro pendiente
  const pendientesCobro = ventasReales.filter(v => v.pago !== "cobrado");

  // Estafas para mostrar alerta
  const cantEstafas = ventas.filter(v => v.estafa).length;
  const totalEstafas = ventas.filter(v => v.estafa).reduce((a, v) => a + (v.total || 0), 0);

  return (
    <div className="section">
      <h2 className="section-title">Dashboard</h2>

      <div className="metrics-grid">
        {metrics.map((m) => (
          <div key={m.label} className="metric-card">
            <p className="metric-label">{m.label}</p>
            <p className="metric-value" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {stockCritico.length > 0 && (
        <div className="alert alert-red">
          ⚠️ Stock crítico: {stockCritico.map(s => s.nombre).join(", ")}
        </div>
      )}

      {deudaProv > 0 && (
        <div className="alert alert-amber">
          ⚠️ Deuda con proveedores: {fmt(deudaProv)}
        </div>
      )}

      {cantEstafas > 0 && (
        <div className="alert alert-red">
          🚨 {cantEstafas} venta(s) marcada(s) como estafa — {fmt(totalEstafas)} en riesgo (no incluidas en los totales)
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <h3 className="card-title">Entregas pendientes</h3>
          {pendientesEntrega.length === 0 ? (
            <p className="empty">Sin pendientes</p>
          ) : (
            pendientesEntrega.map((v) => (
              <div key={v.id} className="list-item">
                <div>
                  <p className="item-main">{v.cliente}</p>
                  <p className="item-sub">{v.producto} × {v.cantidad}</p>
                  {v.fechaEntrega && <p className="item-sub">Entrega: {v.fechaEntrega}</p>}
                </div>
                <span className={`badge badge-${v.entrega === "programado" ? "blue" : "amber"}`}>
                  {v.entrega}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Cobros pendientes</h3>
          {pendientesCobro.length === 0 ? (
            <p className="empty">Todo cobrado</p>
          ) : (
            pendientesCobro.map((v) => (
              <div key={v.id} className="list-item">
                <div>
                  <p className="item-main">{v.cliente}</p>
                  <p className="item-sub">{fmt(v.total)}</p>
                </div>
                <span className={`badge badge-${v.pago === "parcial" ? "amber" : "red"}`}>
                  {v.pago}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Últimas ventas</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Producto</th>
                <th>Total</th>
                <th>Entrega</th>
                <th>Cobro</th>
              </tr>
            </thead>
            <tbody>
              {[...ventasReales].reverse().slice(0, 5).map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha}</td>
                  <td>{v.cliente}</td>
                  <td>{v.vendedor || "—"}</td>
                  <td>{v.producto}</td>
                  <td>{fmt(v.total)}</td>
                  <td>
                    <span className={`badge badge-${v.entrega === "entregado" ? "green" : v.entrega === "programado" ? "blue" : "amber"}`}>
                      {v.entrega}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${v.pago === "cobrado" ? "green" : v.pago === "parcial" ? "amber" : "red"}`}>
                      {v.pago}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;