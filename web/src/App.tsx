import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import { WebSocketProvider } from './hooks/useWebSocket';

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
          </Routes>
        </Container>
      </Box>
    </WebSocketProvider>
  );
};

export default App; 