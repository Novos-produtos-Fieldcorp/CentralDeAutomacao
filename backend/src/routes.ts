import { Router } from "express";
import { companyRoutes } from "./routes/companies.js";
import { motoristaRoutes } from "./routes/motoristas.js";
import { veiculoRoutes } from "./routes/veiculos.js";
import { clienteRoutes } from "./routes/clientes.js";
import { wiseappRoutes } from "./routes/wiseapp.js";
import { healthRoutes } from "./routes/health.js";

const router = Router();

// Health routes
router.use('/', healthRoutes);

// API routes
router.use('/companies', companyRoutes);
router.use('/motoristas', motoristaRoutes);
router.use('/veiculos', veiculoRoutes);
router.use('/clientes', clienteRoutes);
router.use('/wiseapp', wiseappRoutes);

export { router as registerRoutes };
