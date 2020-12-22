var express = require('express');
var router = express.Router();
var multer = require('multer');
var fse = require("fs-extra");
var fs = require("fs");
const {exec} = require('child_process');

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "ex02/staging/" + req.stagingId + "/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})
var upload = multer({storage: storage});


function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function createStagingFolder(req, res, next) {
    let sanitizedName = req.query.name.replace(/\W/g, '')
    let stagingId = makeid(14) + "-" + sanitizedName;
    fs.mkdirSync(`ex02/staging/` + stagingId);
    req.stagingId = stagingId;
    next();
}

function updateTests(testType, cb) {
    exec("git pull", {cwd: "./ex02/tests"}, function() {
        cb();
    });
}

function runTests(stagingId, cb) {
    exec("python ./test_runner.py", {timeout: 1000 * 30, cwd: "./ex02/staging/" + stagingId + "/"}, cb);
}

function blockUnallowed(req, res, next) {
    let bannedNames = [];
    let bannedIps = [];
    try {
        console.log(`POST request received: name: ${req.query.name}, IP: ${req.connection.remoteAddress}`);
    } catch (err) {
        console.log(`POST request received: IP: ${req.connection.remoteAddress}`);
    }
    if (bannedNames.includes(req.query.name) || bannedIps.includes(req.connection.remoteAddress)) {
        res.send("Talk to me in private in Whatsapp, you are crashing the site! 052-3487450");
        return;
    } else {
        next();
    }
}

function setupStagingArea(stagingId) {
    fse.copySync("ex02/tests", `ex02/staging/${stagingId}`);
}

router.post('/', blockUnallowed, createStagingFolder, upload.array('projectFiles'), function (req, res) {
    let testType = req.body.testType;
    updateTests(testType, function(){
        setupStagingArea(req.stagingId);
        runTests(req.stagingId, function (tests_output) {
            res.render("index", {tests_output: tests_output, stagingId: req.stagingId});
        });
    });
});

router.get('/', function (req, res, next) {
    res.render('ex02');
});

module.exports = router;
