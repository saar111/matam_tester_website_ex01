var express = require('express');
var router = express.Router();
var multer = require('multer');
var fsExtra = require("fs-extra");
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "staging/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalName);
    }
})
var upload = multer({storage: storage});
const {exec} = require('child_process');

let staging_dir = "staging"

function clearStaging(req, res, next) {
    fsExtra.emptyDirSync("staging/");
    next();
}


function pullTests(cb) {

    exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/main/PriorityQueue/main.c -O staging/tests_pq.c", function () {
        exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/main/EventManager/main.c -O staging/tests_em.c", function () {
            cb();
        });
    });
}

function compileCode(is_pq, cb) {
    pullTests(function () {
        cb();
    });
}


function runTests() {
}


router.post('/', clearStaging, upload.array('projectFiles'), function (req, res) {
    console.log(req.body, req.query, req.params);
    compileCode(function () {
        runTests();
        res.json(req.files);
    });
});

router.get('/', function (req, res, next) {
    res.render('index');
});

module.exports = router;
