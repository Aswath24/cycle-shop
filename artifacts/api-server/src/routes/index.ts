import { Router, type IRouter } from "express";
import healthRouter from "./health";
import salesRouter from "./sales";
import inventoryRouter from "./inventory";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/sales", salesRouter);
router.use("/inventory", inventoryRouter);

export default router;
