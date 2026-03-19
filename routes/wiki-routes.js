const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('wiki/index');
});

router.get('/rules', (req, res) => {
  res.render('wiki/rules');
});

router.get('/actions', (req, res) => {
  res.render('wiki/actions');
});

router.get('/strategy', (req, res) => {
  res.render('wiki/strategy');
});

router.get('/industries', (req, res) => {
  res.render('wiki/industries');
});

module.exports = router;
