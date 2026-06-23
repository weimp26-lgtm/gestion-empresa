import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Stock() {
  const [stock, setStock] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtros, setFiltros] = useState({ nombre: "", nivel: "" });
  const [form, setForm] = useState({
    nombre: "",
    qty: 1,
    costo: 0,
    precio: 0,
    cat: "Computadoras",
    minAlert: 3,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "stock"), (snap) => {
      setStock(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

  const stockFiltrado = stock.filter((s) => {
    if (filtros.nombre && !s.nombre?.toLowerCase().includes(filtros.nombre.toLowerCase())) return false;
    if (filtros.nivel === "critico" && s.qty > 3) return false;
    if (filtros.nivel === "bajo" && s.qty > 6) return false;
    return true;
  });

  const totalUnidades = stock.reduce((a, s) => a + (s.qty || 0), 0);
  const valorCosto = stock.reduce((a, s) => a + (s.qty || 0) * (s.costo || 0), 0);
  const valorVenta = stock.reduce((a, s) => a + (s.qty || 0) * (s.precio || 0), 0);

  const guardarProducto = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "stock"), {
      ...form,
      qty: Number(form.qty),
      costo: Number(form.costo),
      precio: Number(form.precio),
      minAlert: Number(form.minAlert),
    });
    setMostrarForm(false);
    setForm({ nombre: "", qty: 1, costo: 0, precio: 0, cat: "Computadoras", minAlert: 3 });
  };

  const actualizarQty = async (id, delta, actual) => {
    const nueva = Math.max(0, (actual || 0) + delta);
    await updateDoc(doc(db, "stock", id), { qty: nueva });
  };

  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">Stock</h2>
        <button className="btn-primary" onClick={() => setMostrarForm(!mostrarForm)}>
          {mostrarForm ? "Cancelar" : "+ Agregar producto"}
        </button>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Productos distintos</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{stock.length}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Unidades totales</p>
          <p className="metric-value" style={{ color: "#185FA5" }}>{totalUnidades}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor de costo</p>
          <p className="metric-value" style={{ color: "#BA7517" }}>{fmt(valorCosto)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor de venta</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(valorVenta)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Margen estimado</p>
          <p className="metric-value" style={{ color: "#1D9E75" }}>{fmt(valorVenta - valorCosto)}</p>
        </div>
      </div>

      {mostrarForm && (
        <div className="card">
          <h3 className="card-title">Agregar producto</h3>
          <form onSubmit={guardarProducto}>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre del producto</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Cantidad inicial</label>
                <input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio de costo</label>
                <input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Precio de venta</label>
                <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
                  <option>Computadoras</option>
                  <option>Monitores</option>
                  <option>Periféricos</option>
                  <option>Redes</option>
                  <option>Accesorios</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="form-group">
                <label>Stock mínimo (alerta)</label>
                <input type="number" min="0" value={form.minAlert} onChange={(e) => setForm({ ...form, minAlert: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-primary">Guardar producto</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3 className="card-title">Filtros</h3>
        <div className="filters">
          <div className="form-group">
            <label>Buscar producto</label>
            <input placeholder="Nombre..." value={filtros.nombre} onChange={(e) => setFiltros({ ...filtros, nombre: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Nivel de stock</label>
            <select value={filtros.nivel} onChange={(e) => setFiltros({ ...filtros, nivel: e.target.value })}>
              <option value="">Todos</option>
              <option value="critico">Crítico (3 o menos)</option>
              <option value="bajo">Bajo (6 o menos)</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setFiltros({ nombre: "", nivel: "" })}>Limpiar</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th><th>Categoría</th><th>Stock</th>
                <th>Costo</th><th>Venta</th><th>Margen</th><th>Ajustar</th>
              </tr>
            </thead>
            <tbody>
              {stockFiltrado.map((s) => {
                const margen = s.precio > 0 ? Math.round((s.precio - s.costo) / s.precio * 100) : 0;
                const nivel = s.qty <= (s.minAlert || 3) ? "red" : s.qty <= 6 ? "amber" : "green";
                return (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td>{s.cat}</td>
                    <td><span className={`badge badge-${nivel}`}>{s.qty} uds.</span></td>
                    <td>{fmt(s.costo)}</td>
                    <td>{fmt(s.precio)}</td>
                    <td>{margen}%</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-xs" onClick={() => actualizarQty(s.id, -1, s.qty)}>−</button>
                        <button className="btn-xs" onClick={() => actualizarQty(s.id, 1, s.qty)}>+</button>
                      </div>
                    </td>
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