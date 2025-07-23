import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './common/pages/Login';
import Register from './common/pages/Register';
import Dashboard from './manager/Dashboard';
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/manager/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
