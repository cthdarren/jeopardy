import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import Editor from './pages/Editor';
import Library from './pages/Library';
import Play from './pages/Play';
import './styles.css';

const router = createBrowserRouter([
  { path: '/', element: <Library /> },
  { path: '/edit/:id', element: <Editor /> },
  { path: '/play/:id', element: <Play /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
