var express = require('express');
var router = express.Router();
var multer  = require('multer');
var upload = multer();

router.post('/', upload.array('projectFiles'), function(req, res) {
	res.json(req.files);
});

router.get('/', function(req, res, next) {
  res.render('index');
});

module.exports = router;
