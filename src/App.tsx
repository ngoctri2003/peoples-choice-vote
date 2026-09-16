import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import VotePage from './pages/VotePage'
import DisplayPage from './pages/DisplayPage'
import McPage from './pages/McPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/vote" element={<VotePage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/mc" element={<McPage />} />
        <Route path="*" element={<Navigate to="/vote" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
