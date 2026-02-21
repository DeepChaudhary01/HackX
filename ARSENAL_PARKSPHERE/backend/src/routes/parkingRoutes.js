const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parkingController');

// GET /api/parking/nearby?lat=&lng=&radius=
router.get('/nearby', parkingController.getNearby);

// GET /api/parking/:id
router.get('/:id', parkingController.getById);

module.exports = router;
