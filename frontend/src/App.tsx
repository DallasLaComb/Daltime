import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './common/pages/Login';
import Register from './common/pages/Register';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path="/" element={<Register />} />
        <Route exact path="/login" element={<Login />} />
        <Route exact path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
