'use strict';

const express = require('express');
const {
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  replaceSpeakers,
  replaceCommittee,
  replaceAgenda,
  replaceSponsors,
  replaceFaqs,
  replaceAnnouncements,
} = require('../controllers/adminEventController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// checkin_staff and counter_staff can view events, manager+ can edit.
router.use(requireAuth);

router.get('/', requireRole('superadmin', 'manager', 'checkin_staff', 'counter_staff'), listEvents);
router.post('/', requireRole('superadmin', 'manager'), createEvent);
router.get('/:id', requireRole('superadmin', 'manager', 'checkin_staff', 'counter_staff'), getEvent);
router.patch('/:id', requireRole('superadmin', 'manager'), updateEvent);
router.delete('/:id', requireRole('superadmin', 'manager'), deleteEvent);

router.put('/:id/speakers', replaceSpeakers);
router.put('/:id/committee', replaceCommittee);
router.put('/:id/agenda', replaceAgenda);
router.put('/:id/sponsors', replaceSponsors);
router.put('/:id/faqs', replaceFaqs);
router.put('/:id/announcements', replaceAnnouncements);

module.exports = router;
