import { Navigate, Route, Routes } from 'react-router-dom';

import RequestDetail from './pages/RequestDetail';
import RequestForm from './pages/RequestForm';
import RequestList from './pages/RequestList';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/requests" replace />} />
      <Route path="/requests" element={<RequestList />} />
      <Route path="/requests/new" element={<RequestForm />} />
      <Route path="/requests/:id" element={<RequestDetail />} />
    </Routes>
  );
}

export default App;
