'use strict';

const express = require('express');
const { getTicket, getTicketQrImage, getTicketPdf, getCertificatePdf, getBadgePdf } = require('../controllers/publicTicketController');

const router = express.Router();

router.get('/:qrToken', getTicket);
router.get('/:qrToken/qr.png', getTicketQrImage);
router.get('/:qrToken/pdf', getTicketPdf);
router.get('/:qrToken/certificate', getCertificatePdf);
router.get('/:qrToken/certificate.:ext', getCertificatePdf);
router.get('/:qrToken/certificate.pdf', getCertificatePdf);
router.get('/:qrToken/badge.pdf', getBadgePdf);
router.get('/:qrToken/id-card.pdf', getBadgePdf);
router.get('/:qrToken/badge', getBadgePdf);

module.exports = router;
