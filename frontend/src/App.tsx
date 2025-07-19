import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './common/pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path="/login" element={<Login />} />
        {/* You can add more routes here */}
        <Route path="/" element={<h1>Hello, World!</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
