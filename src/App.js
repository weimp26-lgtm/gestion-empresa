import React, { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Ventas from "./components/Ventas";
import Stock from "./components/Stock";
import Proveedores from "./components/Proveedores";
import Compras from "./components/Compras";
import Caja from "./components/Caja";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div className="loading-screen">
      <p>Cargando...</p>
    </div>
  );

  if (!user) return <Login />;

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "ventas", label: "Ventas" },
    { id: "stock", label: "Stock" },
    { id: "proveedores", label: "Proveedores" },
    { id: "compras", label: "Compras" },
    { id: "caja", label: "Caja" },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>Gestión Empresa</h1>
        </div>
        <nav className="app-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`nav-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="logout-btn" onClick={() => signOut(auth)}>
            Salir
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === "dashboard" && <Dashboard />}
        {tab === "ventas" && <Ventas />}
        {tab === "stock" && <Stock />}
        {tab === "proveedores" && <Proveedores />}
        {tab === "compras" && <Compras />}
        {tab === "caja" && <Caja />}
      </main>
    </div>
  );
}

export default App;