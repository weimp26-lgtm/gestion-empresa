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

  // Stock calculado
  const calcularStock = () => {
    const productos = {};
    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0, costoTotal: 0, ventaTotal: 0 };
      productos[nombre].comprado += Number(c.cantidad || 0);
      productos[nombre].costoTotal += Number(c.cantidad || 0) * Number(c.costoUnit || 0);
    });
    ventasReales.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, vendido: 0, costoTotal: 0, ventaTotal: 0 };
      productos[nombre].vendido += Number(v.cantidad || 0);
      productos[nombre].ventaTotal += Number(v.total || 0);
    });
    return Object.entries(productos).map(([nombre, d]) => ({
      nombre,
      ...d,
      stockActual: d.comprado - d.vendido,
      costoUnitario: d.comprado > 0 ? d.costoTotal / d.comprado : 0,
    }));
  };

  const stockCalculado = calcularStock();
  const stockVal = stockCalculado.reduce((a, s) => a + s.stockActual * s.costoUnitario, 0);
  const stockCritico = stockCalculado.filter(s => s.stockActual <= 3 && s.stockActual >= 0);

  // Margen — solo productos que se vendieron
  const totalCostoVendido = stockCalculado.reduce((a, s) => {
    const costoUnit = s.comprado > 0 ? s.costoTotal / s.comprado : 0;
    return a + (s.vendido * costoUnit);
  }, 0);
  const totalVentaVendido = stockCalculado.reduce((a, s) => a + s.ventaTotal, 0);
  const gananciaReal = totalVentaVendido - totalCostoVendido;
  const margenReal = totalVentaVendido > 0 ? Math.round((gananciaReal / totalVentaVendido) * 100) : 0;

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
          <p className="metric-label">Valor en stock</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{fmt(stockVal)}</p>
        </div>
      </div>

      {/* Balance compra vs venta */}
      <div className="card" style={{ borderLeft: "3px solid #1D9E75", marginBottom: "1rem" }}>
        <h3 className="card-title">Balance compra vs venta</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Lo que costó lo vendido</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#A32D2D" }}>{fmt(totalCostoVendido)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Lo que vendiste</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmt(totalVentaVendido)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ganancia real</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: gananciaReal >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmt(gananciaReal)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Margen sobre ventas</p>
            <p style={{ fontSize: "28px", fontWeight: 500, color: margenReal >= 20 ? "#1D9E75" : margenReal >= 10 ? "#BA7517" : "#A32D2D" }}>
              {margenReal}%
            </p>
          </div>
        </div>

        {/* Desglose por producto */}
        {stockCalculado.filter(s => s.vendido > 0).length > 0 && (
          <>
            <div style={{ borderTop: "0.5px solid #e0dfd8", marginTop: "1rem", paddingTop: "1rem" }}>
              <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>Margen por producto</p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Unidades vendidas</th>
                      <th>Costo unit.</th>
                      <th>Precio venta prom.</th>
                      <th>Ganancia</th>
                      <th>Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockCalculado.filter(s => s.vendido > 0).map((s, i) => {
                      const costoUnit = s.comprado > 0 ? s.costoTotal / s.comprado : 0;
                      const precioVentaProm = s.vendido > 0 ? s.ventaTotal / s.vendido : 0;
                      const ganancia = s.ventaTotal - (s.vendido * costoUnit);
                      const margen = s.ventaTotal > 0 ? Math.round((ganancia / s.ventaTotal) * 100) : 0;
                      return (
                        <tr key={i}>
                          <td><strong>{s.nombre}</strong></td>
                          <td>{s.vendido}</td>
                          <td>{fmt(costoUnit)}</td>
                          <td>{fmt(precioVentaProm)}</td>
                          <td style={{ color: ganancia >= 0 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{fmt(ganancia)}</td>
                          <td>
                            <span style={{ fontWeight: 500, color: margen >= 20 ? "#1D9E75" : margen >= 10 ? "#BA7517" : "#A32D2D" }}>
                              {margen}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
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