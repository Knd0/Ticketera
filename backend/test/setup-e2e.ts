// Las pruebas de punta a punta usan su propia base (por defecto ticketera_e2e)
// y nunca la de desarrollo: al terminar borran todo lo que crearon.
import { config } from 'dotenv';
config();
process.env.DB_NAME = process.env.E2E_DB_NAME || 'ticketera_e2e';
process.env.ENABLE_MOCK_PAYMENTS = 'true';
process.env.NODE_ENV = 'test';
