import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './common/pages/Login';
import Register from './common/pages/Register';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
