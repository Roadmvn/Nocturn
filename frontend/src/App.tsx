import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Console from './pages/Console'
import Builder from './pages/Builder'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('nocturn_token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute><Dashboard /></PrivateRoute>
        } />
        <Route path="/agent/:id" element={
          <PrivateRoute><Console /></PrivateRoute>
        } />
        <Route path="/builder" element={
          <PrivateRoute><Builder /></PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
