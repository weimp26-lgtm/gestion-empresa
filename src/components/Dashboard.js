import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

function Dashboard() {
  const [ventas, setVentas] = useState([]);
  const [compras, setCompras] = useState([]);

  useEffect(() => {
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubVentas(); unsubCompras(); };
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const ventasReales = ventas.filter(v => !v.estafa);

  const totalVentas = ventasReales.reduce((a, v) => a + (v.total || 0), 0);
  const cobrado = ventasReales.filter(v => v.pago === "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendCobro = ventasReales.filter(v => v.pago !== "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendEntrega = ventasReales.filter(v => v.entrega !== "entregado").length;
  const deudaProv = compras.filter(c => c.pago === "pendiente").reduce((a, c) => a + (c.total || 0), 0);

  // Calcular por producto
  const calcularProductos = () => {
    const productos = {};

    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, costoTotal: 0, vendido: 0, ingresoTotal: 0 };
      productos[nombre].comprado += Number(c.cantidad || 0);
      productos[nombre].costoTotal += Number(c.cantidad || 0) * Number(c.costoUnit || 0);
    });

    ventasReales.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, costoTotal: 0, vendido: 0, ingresoTotal: 0 };
      productos[nombre].vendido += Number(v.cantidad || 0);
      productos[nombre].ingresoTotal += Number(v.total || 0);
    });

    return Object.entries(productos).map(([nombre, d]) => {
      const costoUnit = d.comprado > 0 ? d.costoTotal / d.comprado : 0;
      const stockActual = d.comprado - d.vendido;
      const costoVendido = d.vendido * costoUnit;
      const ganancia = d.ingresoTotal - costoVendido;
      const margen = d.ingresoTotal > 0 ? Math.round((ganancia / d.ingresoTotal) * 100) : 0;
      const precioVentaProm = d.vendido > 0 ? d.ingresoTotal / d.vendido : 0;
      return { nombre, ...d, costoUnit, stockActual, costoVendido, ganancia, margen, precioVentaProm };
    });
  };

  const productos = calcularProductos();

  // Totales generales
  const totalCostoVendido = productos.reduce((a, p) => a + p.costoVendido, 0);
  const totalIngresoVentas = productos.reduce((a, p) => a + p.ingresoTotal, 0);
  const gananciaReal = totalIngresoVentas - totalCostoVendido;
  const margenReal = totalIngresoVentas > 0 ? Math.round((gananciaReal / totalIngresoVentas) * 100) : 0;
  const totalInvertidoStock = productos.reduce((a, p) => a + (p.stockActual > 0 ? p.stockActual * p.costoUnit : 0), 0);

  const stockCritico = productos.filter(p => p.stockActual <= 3 && p.stockActual >= 0);
  const cantEstafas = ventas.filter(v => v.estafa).length;
  const totalEstafas = ventas.filter(v => v.estafa).reduce((a, v) => a + (v.total || 0), 0);
  const pendientesEntrega = ventasReales.filter(v => v.entrega !== "entregado");
  const pendientesCobro = ventasReales.filter(v => v.pago !== "cobrado");

  return (
    <div className="section">
      <h2 className="section-title">Dashboard</h2>

      {/* Métricas principales */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Ventas totales</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{fmt(totalVentas)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Cobrado</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(cobrado)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Por cobrar</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(pendCobro)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Entregas pendientes</p>
          <p className="metric-value" style={{ color: pendEntrega > 3 ? "#A32D2D" : "#BA7517" }}>{pendEntrega}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Deuda proveedores</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmt(deudaProv)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Invertido en stock actual</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{fmt(totalInvertidoStock)}</p>
        </div>
      </div>

      {/* Balance real compra vs venta */}
      <div className="card" style={{ borderLeft: "3px solid #1D9E75", marginBottom: "1rem" }}>
        <h3 className="card-title">Balance real — compras vs ventas</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Costo de lo vendido</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#A32D2D" }}>{fmt(totalCostoVendido)}</p>
            <p style={{ fontSize: "11px", color: "#aaa" }}>Lo que te costó lo que vendiste</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ingreso por ventas</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmt(totalIngresoVentas)}</p>
            <p style={{ fontSize: "11px", color: "#aaa" }}>Lo que cobraste / vas a cobrar</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ganancia real</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: gananciaReal >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(gananciaReal)}</p>
            <p style={{ fontSize: "11px", color: "#aaa" }}>Ingreso − costo de lo vendido</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Margen sobre ventas</p>
            <p style={{ fontSize: "32px", fontWeight: 500, color: margenReal >= 20 ? "#1D9E75" : margenReal >= 10 ? "#BA7517" : "#A32D2D" }}>
              {margenReal}%
            </p>
          </div>
        </div>

        {/* Desglose por producto */}
        {productos.filter(p => p.vendido > 0).length > 0 && (
          <div style={{ borderTop: "0.5px solid #e0dfd8", paddingTop: "1rem" }}>
            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>Desglose por producto</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Comprado</th>
                    <th>Vendido</th>
                    <th>Stock actual</th>
                    <th>Costo unit.</th>
                    <th>Precio venta prom.</th>
                    <th>Costo vendido</th>
                    <th>Ingreso ventas</th>
                    <th>Ganancia</th>
                    <th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.filter(p => p.vendido > 0).map((p, i) => (
                    <tr key={i}>
                      <td><strong>{p.nombre}</strong></td>
                      <td>{p.comprado}</td>
                      <td>{p.vendido}</td>
                      <td>
                        <span className={`badge badge-${p.stockActual <= 3 ? "red" : p.stockActual <= 6 ? "amber" : "green"}`}>
                          {p.stockActual}
                        </span>
                      </td>
                      <td>{fmt(p.costoUnit)}</td>
                      <td>{fmt(p.precioVentaProm)}</td>
                      <td style={{ color: "#A32D2D" }}>{fmt(p.costoVendido)}</td>
                      <td style={{ color: "#185FA5" }}>{fmt(p.ingresoTotal)}</td>
                      <td style={{ color: p.ganancia >= 0 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{fmt(p.ganancia)}</td>
                      <td>
                        <span style={{ fontWeight: 500, color: p.margen >= 20 ? "#1D9E75" : p.margen >= 10 ? "#BA7517" : "#A32D2D" }}>
                          {p.margen}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Alertas */}
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
          🚨 {cantEstafas} venta(s) marcada(s) como estafa — {fmt(totalEstafas)} en riesgo
        </div>
      )}

      {/* Pendientes */}
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

      {/* Últimas ventas */}
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