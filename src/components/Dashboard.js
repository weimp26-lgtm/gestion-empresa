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

  const fmtARS = (n) => "$" + Number(n || 0).toLocaleString("es-AR");
  const fmtUSD = (n) => "USD " + Number(n || 0).toLocaleString("es-AR");

  const ventasReales = ventas.filter(v => !v.estafa);
  const ventasARS = ventasReales.filter(v => v.moneda !== "USD");
  const ventasUSD = ventasReales.filter(v => v.moneda === "USD");

  const totalVentasARS = ventasARS.reduce((a, v) => a + (v.total || 0), 0);
  const totalVentasUSD = ventasUSD.reduce((a, v) => a + (v.total || 0), 0);
  const cobradoARS = ventasARS.filter(v => v.pago === "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const cobradoUSD = ventasUSD.filter(v => v.pago === "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendCobroARS = ventasARS.filter(v => v.pago !== "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendCobroUSD = ventasUSD.filter(v => v.pago !== "cobrado").reduce((a, v) => a + (v.total || 0), 0);
  const pendEntrega = ventasReales.filter(v => v.entrega !== "entregado").length;
  const deudaProvARS = compras.filter(c => c.pago === "pendiente" && c.moneda !== "USD").reduce((a, c) => a + (c.total || 0), 0);
  const deudaProvUSD = compras.filter(c => c.pago === "pendiente" && c.moneda === "USD").reduce((a, c) => a + (c.total || 0), 0);

  const calcularProductos = (monedaFiltro) => {
    const productos = {};
    compras.filter(c => monedaFiltro === "USD" ? c.moneda === "USD" : c.moneda !== "USD").forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      const costoUnitReal = Number(c.costoUnit || c.costo || 0);
      const cantidadReal = Number(c.cantidad || 0);
      if (!productos[nombre]) productos[nombre] = { comprado: 0, costoTotal: 0, vendido: 0, ingresoTotal: 0, costoUnit: 0, ultimaCompra: "" };
      productos[nombre].comprado += cantidadReal;
      productos[nombre].costoTotal += cantidadReal * costoUnitReal;
      if ((c.fecha || "") >= productos[nombre].ultimaCompra) {
        productos[nombre].ultimaCompra = c.fecha || "";
        productos[nombre].costoUnit = costoUnitReal;
      }
    });
    ventasReales.filter(v => monedaFiltro === "USD" ? v.moneda === "USD" : v.moneda !== "USD").forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) productos[nombre] = { comprado: 0, costoTotal: 0, vendido: 0, ingresoTotal: 0, costoUnit: 0, ultimaCompra: "" };
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
      const valorStock = stockActual > 0 ? stockActual * costoUnit : 0;
      return { nombre, ...d, costoUnit, stockActual, costoVendido, ganancia, margen, precioVentaProm, valorStock };
    });
  };

  const productosARS = calcularProductos("ARS");
  const productosUSD = calcularProductos("USD");

  const totalCostoVendidoARS = productosARS.reduce((a, p) => a + p.costoVendido, 0);
  const gananciaRealARS = totalVentasARS - totalCostoVendidoARS;
  const margenARS = totalVentasARS > 0 ? Math.round((gananciaRealARS / totalVentasARS) * 100) : 0;
  const totalInvertidoStockARS = productosARS.reduce((a, p) => a + p.valorStock, 0);

  const totalCostoVendidoUSD = productosUSD.reduce((a, p) => a + p.costoVendido, 0);
  const gananciaRealUSD = totalVentasUSD - totalCostoVendidoUSD;
  const margenUSD = totalVentasUSD > 0 ? Math.round((gananciaRealUSD / totalVentasUSD) * 100) : 0;
  const totalInvertidoStockUSD = productosUSD.reduce((a, p) => a + p.valorStock, 0);

  // Stock crítico — todos los productos
  const todosProductos = [...productosARS, ...productosUSD].reduce((acc, p) => {
    const existe = acc.find(x => x.nombre === p.nombre);
    if (!existe) acc.push(p);
    return acc;
  }, []);
  const stockCritico = todosProductos.filter(p => p.stockActual <= 3 && p.stockActual >= 0);

  const cantEstafas = ventas.filter(v => v.estafa).length;
  const totalEstafasARS = ventas.filter(v => v.estafa && v.moneda !== "USD").reduce((a, v) => a + (v.total || 0), 0);
  const totalEstafasUSD = ventas.filter(v => v.estafa && v.moneda === "USD").reduce((a, v) => a + (v.total || 0), 0);
  const pendientesEntrega = ventasReales.filter(v => v.entrega !== "entregado");
  const pendientesCobro = ventasReales.filter(v => v.pago !== "cobrado");

  const TablaProductos = ({ productos, fmt }) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Producto</th><th>Comprado</th><th>Vendido</th><th>Stock actual</th>
            <th>Costo unit.</th><th>Precio venta prom.</th><th>Costo vendido</th>
            <th>Ingreso ventas</th><th>Ganancia</th><th>Margen</th>
          </tr>
        </thead>
        <tbody>
          {productos.filter(p => p.vendido > 0).map((p, i) => (
            <tr key={i}>
              <td><strong>{p.nombre}</strong></td>
              <td>{p.comprado}</td>
              <td>{p.vendido}</td>
              <td><span className={`badge badge-${p.stockActual <= 3 ? "red" : p.stockActual <= 6 ? "amber" : "green"}`}>{p.stockActual}</span></td>
              <td>{fmt(p.costoUnit)}</td>
              <td>{fmt(p.precioVentaProm)}</td>
              <td style={{ color: "#A32D2D" }}>{fmt(p.costoVendido)}</td>
              <td style={{ color: "#185FA5" }}>{fmt(p.ingresoTotal)}</td>
              <td style={{ color: p.ganancia >= 0 ? "#1D9E75" : "#A32D2D", fontWeight: 500 }}>{fmt(p.ganancia)}</td>
              <td><span style={{ fontWeight: 500, color: p.margen >= 20 ? "#1D9E75" : p.margen >= 10 ? "#BA7517" : "#A32D2D" }}>{p.margen}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="section">
      <h2 className="section-title">Dashboard</h2>

      {/* Métricas principales — 2 filas */}
      <div className="metrics-grid" style={{ marginBottom: "0.5rem" }}>
        <div className="metric-card">
          <p className="metric-label">Ventas ARS</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{fmtARS(totalVentasARS)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Ventas USD</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{fmtUSD(totalVentasUSD)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Entregas pendientes</p>
          <p className="metric-value" style={{ color: pendEntrega > 3 ? "#A32D2D" : "#BA7517" }}>{pendEntrega}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Deuda proveedores ARS</p>
          <p className="metric-value" style={{ color: "#A32D2D" }}>{fmtARS(deudaProvARS)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Cobros pendientes ARS</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmtARS(pendCobroARS)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Cobros pendientes USD</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmtUSD(pendCobroUSD)}</p>
        </div>
      </div>

      {/* Stock crítico mini recuadro */}
      {stockCritico.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div className="alert alert-red" style={{ borderRadius: "12px", padding: "0" }}>
            <div style={{ padding: "10px 14px", borderBottom: "0.5px solid #F7C1C1" }}>
              <strong style={{ fontSize: "12px" }}>⚠️ Stock crítico — {stockCritico.length} producto(s)</strong>
            </div>
            <div style={{ padding: "8px 14px" }}>
              {stockCritico.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < stockCritico.length - 1 ? "0.5px solid #F7C1C1" : "none" }}>
                  <span style={{ fontSize: "12px", color: "#A32D2D" }}>{s.nombre}</span>
                  <span className="badge badge-red">{s.stockActual} {s.stockActual === 1 ? "unidad" : "unidades"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas estafas si hay */}
          {cantEstafas > 0 && (
            <div className="alert alert-red" style={{ borderRadius: "12px" }}>
              🚨 {cantEstafas} venta(s) marcada(s) como estafa<br />
              {totalEstafasARS > 0 && <span>{fmtARS(totalEstafasARS)} en riesgo</span>}
              {totalEstafasUSD > 0 && <span> / {fmtUSD(totalEstafasUSD)} en riesgo</span>}
            </div>
          )}
        </div>
      )}

      {/* Alerta estafas si no hay stock crítico */}
      {stockCritico.length === 0 && cantEstafas > 0 && (
        <div className="alert alert-red" style={{ marginBottom: "1rem" }}>
          🚨 {cantEstafas} venta(s) marcada(s) como estafa —
          {totalEstafasARS > 0 && ` ${fmtARS(totalEstafasARS)}`}
          {totalEstafasUSD > 0 && ` / ${fmtUSD(totalEstafasUSD)}`} en riesgo
        </div>
      )}

      {/* Deuda proveedores alerta */}
      {(deudaProvARS > 0 || deudaProvUSD > 0) && (
        <div className="alert alert-amber" style={{ marginBottom: "1rem" }}>
          ⚠️ Deuda con proveedores: {deudaProvARS > 0 && fmtARS(deudaProvARS)} {deudaProvUSD > 0 && fmtUSD(deudaProvUSD)}
        </div>
      )}

      {/* Balance ARS */}
      <div className="card" style={{ borderLeft: "3px solid #1D9E75", marginBottom: "1rem" }}>
        <h3 className="card-title">Balance pesos (ARS)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: productosARS.filter(p => p.vendido > 0).length > 0 ? "1rem" : "0" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Costo de lo vendido</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#A32D2D" }}>{fmtARS(totalCostoVendidoARS)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ingreso por ventas</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmtARS(totalVentasARS)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ganancia real</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: gananciaRealARS >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmtARS(gananciaRealARS)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Margen</p>
            <p style={{ fontSize: "32px", fontWeight: 500, color: margenARS >= 20 ? "#1D9E75" : margenARS >= 10 ? "#BA7517" : "#A32D2D" }}>{margenARS}%</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Stock invertido ARS</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmtARS(totalInvertidoStockARS)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Por cobrar ARS</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#BA7517" }}>{fmtARS(pendCobroARS)}</p>
          </div>
        </div>
        {productosARS.filter(p => p.vendido > 0).length > 0 && (
          <div style={{ borderTop: "0.5px solid #e0dfd8", paddingTop: "1rem" }}>
            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>Desglose por producto (ARS)</p>
            <TablaProductos productos={productosARS} fmt={fmtARS} />
          </div>
        )}
      </div>

      {/* Balance USD */}
      <div className="card" style={{ borderLeft: "3px solid #185FA5", marginBottom: "1rem" }}>
        <h3 className="card-title">Balance dólares (USD)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: productosUSD.filter(p => p.vendido > 0).length > 0 ? "1rem" : "0" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Costo de lo vendido</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#A32D2D" }}>{fmtUSD(totalCostoVendidoUSD)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ingreso por ventas</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmtUSD(totalVentasUSD)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Ganancia real</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: gananciaRealUSD >= 0 ? "#1D9E75" : "#A32D2D" }}>{fmtUSD(gananciaRealUSD)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Margen</p>
            <p style={{ fontSize: "32px", fontWeight: 500, color: margenUSD >= 20 ? "#1D9E75" : margenUSD >= 10 ? "#BA7517" : "#A32D2D" }}>{margenUSD}%</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Stock invertido USD</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#185FA5" }}>{fmtUSD(totalInvertidoStockUSD)}</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "4px" }}>Por cobrar USD</p>
            <p style={{ fontSize: "18px", fontWeight: 500, color: "#BA7517" }}>{fmtUSD(pendCobroUSD)}</p>
          </div>
        </div>
        {productosUSD.filter(p => p.vendido > 0).length > 0 && (
          <div style={{ borderTop: "0.5px solid #e0dfd8", paddingTop: "1rem" }}>
            <p style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "10px" }}>Desglose por producto (USD)</p>
            <TablaProductos productos={productosUSD} fmt={fmtUSD} />
          </div>
        )}
      </div>

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
                <span className={`badge badge-${v.entrega === "programado" ? "blue" : "amber"}`}>{v.entrega}</span>
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
                  <p className="item-sub">{v.moneda === "USD" ? fmtUSD(v.total) : fmtARS(v.total)}</p>
                </div>
                <span className={`badge badge-${v.pago === "parcial" ? "amber" : "red"}`}>{v.pago}</span>
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
                <th>Fecha</th><th>Cliente</th><th>Vendedor</th><th>Producto</th>
                <th>Total</th><th>Moneda</th><th>Entrega</th><th>Cobro</th>
              </tr>
            </thead>
            <tbody>
              {[...ventasReales].reverse().slice(0, 5).map((v) => (
                <tr key={v.id}>
                  <td>{v.fecha}</td>
                  <td>{v.cliente}</td>
                  <td>{v.vendedor || "—"}</td>
                  <td>{v.producto}</td>
                  <td>{v.moneda === "USD" ? fmtUSD(v.total) : fmtARS(v.total)}</td>
                  <td><span className={`badge badge-${v.moneda === "USD" ? "blue" : "green"}`}>{v.moneda || "ARS"}</span></td>
                  <td><span className={`badge badge-${v.entrega === "entregado" ? "green" : v.entrega === "programado" ? "blue" : "amber"}`}>{v.entrega}</span></td>
                  <td><span className={`badge badge-${v.pago === "cobrado" ? "green" : v.pago === "parcial" ? "amber" : "red"}`}>{v.pago}</span></td>
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