import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://chat.wiseapp360.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Request headers:', proxyReq.getHeaders());
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Response headers:', proxyRes.headers);
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization, api_access_token, Accept'
        }
      },
      "/supabase-edge-functions": {
        target: process.env.VITE_SUPABASE_URL || "https://your-project.supabase.co",
        changeOrigin: true,
        secure: true,
        proxyTimeout: 15000, // 15 seconds
        timeout: 15000, // 15 seconds
        rewrite: (path) => path.replace(/^\/supabase-edge-functions/, "/functions/v1"),
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Supabase Edge Function proxy error', err);
            // Handle proxy errors gracefully
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                error: 'Connection timeout or server error' 
              }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Edge Function Request:', req.method, req.url);
            // Set timeout headers
            proxyReq.setTimeout(15000);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Edge Function Response:', proxyRes.statusCode, req.url);
          });
        },
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept'
        }
      }
    }
  }
});