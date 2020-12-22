var express = require('express');
var router = express.Router();
var multer = require('multer');
var fs = require("fs");

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "ex02/staging/" + req.stagingId + "/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})
var upload = multer({storage: storage});
const {exec} = require('child_process');


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
    fs.mkdirSync(`staging/` + stagingId);
    req.stagingId = stagingId;
    next();
}

function updateTests(cb) {
    cb();
}

function runTests(stagingId, cb) {
    exec("python ./test_runner.py", {timeout: 1000 * 30, cwd: "./ex02"}, cb);
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

router.post('/', blockUnallowed, createStagingFolder, upload.array('projectFiles'), function (req, res) {
    let testType = req.body.testType;
    updateTests(testType, () => {
        setupStagingArea(req.stagingId, function() {
            runTests(req.stagingId, function (tests_output) {
                res.render("index", {tests_output: tests_output});
            });
        });
    });
});

router.get('/', function (req, res, next) {
    res.render('ex02');
});

module.exports = router;
