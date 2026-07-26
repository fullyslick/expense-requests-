import { Navigate, Route, Routes } from 'react-router-dom';

import RequestDetail from './pages/RequestDetail';
import RequestForm from './pages/RequestForm';
import RequestList from './pages/RequestList';

import AppHeader from './components/AppHeader';

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
          {/* Edit is its own route because /requests/:id is the read-only
              detail page — the mockup reaches this from its "Edit" button. */}
          <Route path="/requests/:id/edit" element={<RequestForm />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
