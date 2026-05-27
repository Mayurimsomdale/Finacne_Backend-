// routes/registrationLink.routes.js

import express from 'express';

import {
  requireAdmin,
  validateEmailBody,
  validateExpiryDays,
  guardNoDuplicateActiveLink,
  loadLinkByParam,
  guardLinkValid,
} from '../../middleware/employeeMng/registrationLink.middleware.js';

import {
  generateLink,
  listLinks,
  validateLink,
  deleteLink,
} from '../../controllers/employeeMng/registrationLinkController.js';

const router = express.Router();

// POST /api/registration-links

router.post(
  '/',
  requireAdmin,
  validateEmailBody,
  validateExpiryDays,
  guardNoDuplicateActiveLink,
  generateLink
);

// GET /api/registration-links

router.get(
  '/',
  requireAdmin,
  listLinks
);

// GET /api/registration-links/:linkId/validate

router.get(
  '/:linkId/validate',
  loadLinkByParam,
  guardLinkValid,
  validateLink
);

// DELETE /api/registration-links/:linkId

router.delete(
  '/:linkId',
  requireAdmin,
  loadLinkByParam,
  deleteLink
);

export default router;