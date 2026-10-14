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

// checkin_staff never needs the CMS — everything here is manager+.
router.use(requireAuth, requireRole('superadmin', 'manager'));

router.get('/', listEvents);
router.post('/', createEvent);
router.get('/:id', getEvent);
router.patch('/:id', updateEvent);
router.delete('/:id', deleteEvent);

router.put('/:id/speakers', replaceSpeakers);
router.put('/:id/committee', replaceCommittee);
router.put('/:id/agenda', replaceAgenda);
router.put('/:id/sponsors', replaceSponsors);
router.put('/:id/faqs', replaceFaqs);
router.put('/:id/announcements', replaceAnnouncements);

module.exports = router;
