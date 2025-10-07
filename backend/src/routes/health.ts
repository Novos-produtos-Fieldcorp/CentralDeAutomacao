import { Router } from "express";

const router = Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    platform: 'render-backend'
  });
});

export { router as healthRoutes };
