import { Navigate, Route, Routes } from 'react-router-dom';

import AppHeader from './components/AppHeader';
import RequestDetail from './pages/RequestDetail';
import RequestForm from './pages/RequestForm';
import RequestList from './pages/RequestList';

function App() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[1180px] px-8 py-7">
        <Routes>
          <Route path="/" element={<Navigate to="/requests" replace />} />
          <Route path="/requests" element={<RequestList />} />
          <Route path="/requests/new" element={<RequestForm />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
