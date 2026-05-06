import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ClerkProvider } from "@clerk/react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const rootElement = document.getElementById('root')!;

if (!clerkPubKey) {
  createRoot(rootElement).render(
    <div style={{ padding: '40px', color: '#ff4444', fontFamily: 'sans-serif', backgroundColor: '#000', minHeight: '100vh' }}>
      <h1>Deployment Configuration Error</h1>
      <p>The application failed to start because the <b>VITE_CLERK_PUBLISHABLE_KEY</b> environment variable is missing.</p>
      <p>Please add this variable to your Vercel project settings and trigger a redeployment.</p>
    </div>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}

