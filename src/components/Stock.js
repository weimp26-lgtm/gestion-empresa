import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";

function Stock() {
  const [compras, setCompras] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filtros, setFiltros] = useState({ nombre: "", moneda: "", nivel: "" });

  useEffect(() => {
    const unsubCompras = onSnapshot(collection(db, "compras"), (snap) => {
      setCompras(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubVentas = onSnapshot(collection(db, "ventas"), (snap) => {
      setVentas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubCompras(); unsubVentas(); };
  }, []);

  const fmtARS = (n) => "$" + Number(n || 0).toLocaleString("es-AR");
  const fmtUSD = (n) => "USD " + Number(n || 0).toLocaleString("es-AR");
  const fmt = (n, moneda) => moneda === "USD" ? fmtUSD(n) : fmtARS(n);

  // Calcular stock real por producto
  const calcularStock = () => {
    const productos = {};

    compras.forEach((c) => {
      const nombre = c.producto?.trim();
      if (!nombre) return;
      const costoUnitReal = Number(c.costoUnit || c.costo || 0);
      const cantidadReal = Number(c.cantidad || 0);
      if (!productos[nombre]) {
        productos[nombre] = {
          nombre,
          comprado: 0,
          vendido: 0,
          costoTotal: 0,
          costoUnit: 0,
          moneda: c.moneda || "ARS",
          proveedor: c.proveedorNombre || "—",
          ultimaCompra: c.fecha || "",
        };
      }
      productos[nombre].comprado += cantidadReal;
      productos[nombre].costoTotal += cantidadReal * costoUnitReal;
      productos[nombre].moneda = c.moneda || "ARS";
      productos[nombre].proveedor = c.proveedorNombre || "—";
      if (c.fecha >= productos[nombre].ultimaCompra) {
        productos[nombre].ultimaCompra = c.fecha;
        productos[nombre].costoUnit = costoUnitReal;
      }
    });

    ventas.forEach((v) => {
      const nombre = v.producto?.trim();
      if (!nombre) return;
      if (!productos[nombre]) {
        productos[nombre] = { nombre, comprado: 0, vendido: 0, costoTotal: 0, costoUnit: 0, moneda: "ARS", proveedor: "—", ultimaCompra: "" };
      }
      productos[nombre].vendido += Number(v.cantidad || 0);
    });

    return Object.values(productos).map((p) => ({
      ...p,
      stockActual: p.comprado - p.vendido,
      valorStock: (p.comprado - p.vendido) * p.costoUnit,
    }));
  };

  const stockCalculado = calcularStock();

  const stockFiltrado = stockCalculado.filter((s) => {
    if (filtros.nombre && !s.nombre.toLowerCase().includes(filtros.nombre.toLowerCase())) return false;
    if (filtros.moneda && s.moneda !== filtros.moneda) return false;
    if (filtros.nivel === "critico" && s.stockActual > 3) return false;
    if (filtros.nivel === "bajo" && s.stockActual > 6) return false;
    return true;
  });

  // Métricas
  const totalProductos = stockCalculado.length;
  const totalUnidades = stockCalculado.reduce((a, s) => a + Math.max(0, s.stockActual), 0);
  const valorStockARS = stockCalculado.filter(s => s.moneda !== "USD").reduce((a, s) => a + Math.max(0, s.valorStock), 0);
  const valorStockUSD = stockCalculado.filter(s => s.moneda === "USD").reduce((a, s) => a + Math.max(0, s.valorStock), 0);
  const stockCritico = stockCalculado.filter(s => s.stockActual <= 3 && s.stockActual >= 0);

  const abrirEditar = (s) => {
    setEditandoId(s.nombre);
    setEditForm({ costoUnit: s.costoUnit });
  };

  const guardarEdicion = async (s) => {
    const comprasDelProducto = compras.filter(c => c.producto?.trim() === s.nombre);
    const ultima = comprasDelProducto.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))[0];
    if (ultima) {
      await updateDoc(doc(db, "compras", ultima.id), { costoUnit: Number(editForm.costoUnit) });
    }
    setEditandoId(null);
  };

  return (
    <div className="section">
      <h2 className="section-title">Stock</h2>

      {stockCritico.length > 0 && (
        <div className="alert alert-red">
          ⚠️ Stock crítico: {stockCritico.map(s => s.nombre).join(", ")}
        </div>
      )}

      {/* Métricas */}
      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Productos distintos</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{totalProductos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Unidades totales</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{totalUnidades}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor stock ARS</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmtARS(valorStockARS)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor stock USD</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmtUSD(valorStockUSD)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card">
        <h3 className="card-title">Filtros</h3>
        <div className="filters">
          <div className="form-group">
            <label>Buscar producto</label>
            <input placeholder="Nombre..." value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Moneda</label>
            <select value={filtros.moneda} onChange={(e) => setFiltros({ ...filtros, moneda: e.target.value })}>
              <option value="">Todas</option>
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Nivel de stock</label>
            <select value={filtros.nivel} onChange={(e) => setFiltros({ ...filtros, nivel: e.target.value })}>
              <option value="">Todos</option>
              <option value="critico">Crítico (3 o menos)</option>
              <option value="bajo">Bajo (6 o menos)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ nombre: "", moneda: "", nivel: "" })}>Limpiar</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Proveedor</th>
                <th>Moneda</th>
                <th>Comprado</th>
                <th>Vendido</th>
                <th>Stock actual</th>
                <th>Costo unit.</th>
                <th>Valor en stock</th>
                <th>Última compra</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltrado.map((s, i) => (
                <tr key={i}>
                  <td><strong>{s.nombre}</strong></td>
                  <td>{s.proveedor}</td>
                  <td><span className={`badge badge-${s.moneda === "USD" ? "blue" : "green"}`}>{s.moneda}</span></td>
                  <td>{s.comprado}</td>
                  <td>{s.vendido}</td>
                  <td>
                    <span className={`badge badge-${s.stockActual <= 3 ? "red" : s.stockActual <= 6 ? "amber" : "green"}`}>
                      {s.stockActual} uds.
                    </span>
                  </td>
                  <td>
                    {editandoId === s.nombre ? (
                      <input
                        type="number"
                        value={editForm.costoUnit}
                        onChange={(e) => setEditForm({ ...editForm, costoUnit: e.target.value })}
                        style={{ width: "90px", padding: "3px 6px", fontSize: "12px" }}
                      />
                    ) : (
                      fmt(s.costoUnit, s.moneda)
                    )}
                  </td>
                  <td><strong>{fmt(Math.max(0, s.valorStock), s.moneda)}</strong></td>
                  <td>{s.ultimaCompra || "—"}</td>
                  <td>
                    {editandoId === s.nombre ? (
                      <div className="action-btns">
                        <button className="btn-xs" style={{ color: "#1D9E75", borderColor: "#1D9E75" }} onClick={() => guardarEdicion(s)}>✓ Guardar</button>
                        <button className="btn-xs" onClick={() => setEditandoId(null)}>✕</button>
                      </div>
                    ) : (
                      <button className="btn-xs" onClick={() => abrirEditar(s)}>✏️ Editar costo</button>
                    )}
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

export default Stock;