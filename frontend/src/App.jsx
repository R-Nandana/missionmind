import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { LogOut, Rocket } from 'lucide-react';

function App() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div className="app-container">
      {token && (
        <header className="header animate-fade-in">
          <div className="brand-lockup">
            <span className="brand-mark"><Rocket size={20} /></span>
            <div>
              <h1>MissionMind</h1>
              <span className="brand-caption">MARS 2020 · MISSION INTELLIGENCE</span>
            </div>
          </div>
          <button className="btn btn-secondary logout-button" onClick={handleLogout} aria-label="Sign out">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </header>
      )}
      
      <main>
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
