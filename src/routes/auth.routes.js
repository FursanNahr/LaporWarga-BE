import { Router } from 'express'
import * as authController from '../controllers/auth.controller.js'
import { authenticate } from '../middlewares/authenticate.js'
import { validate } from '../middlewares/validate.js'
import { loginBody, registerBody } from '../validators/auth.validator.js'

const router = Router()

router.post('/register', validate({ body: registerBody }), authController.register)
router.post('/login', validate({ body: loginBody }), authController.login)
router.get('/me', authenticate, authController.me)

export default router
