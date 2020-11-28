var express = require('express');
var router = express.Router();
var multer = require('multer');
var fsExtra = require("fs-extra");
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "staging/");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
})
var upload = multer({storage: storage});
const {exec} = require('child_process');


const GCC_COMPILE_PQ = "gcc -std=c99 -o staging/priority_queue -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";
const GCC_COMPILE_EM = "gcc -std=c99 -o staging/event_manager -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";

const BRANCH = "PriorityQueue";

function pullFile(file, cb) {
    exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/" + BRANCH + "/" + file.remotename + " -O staging/" + file.localname, cb);
}

function updateFiles(files, cb) {
    if (files.length === 0) {
        return cb();
    }
    pullFile(files[0], function () {
        files.splice(0, 1);
        updateFiles(files, cb);
    })
}

function clearStaging(req, res, next) {
    fsExtra.emptyDirSync("staging/");
    next();
}

function pullTests(isPq, cb) {
    if (isPq) {
        updateFiles([{remotename: "PriorityQueue/main.c", localname: "tests_pq.c"}, {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h"}], cb);
    } else {
        updateFiles([{remotename: "EventManager/main.c", localname: "tests_pq.c"}, {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h"}], cb);
    }
}

function compileCode(isPq, cb) {
    pullTests(isPq, function () {
        if (isPq) {
            exec(GCC_COMPILE_PQ, function (error, stdout, stderr) {
                console.log("PQ", "ERROR:", error, "STDERR:", stderr);
                cb(error, stdout, stderr);
            });
        } else {
            exec(GCC_COMPILE_EM, function (error, stdout, stderr) {
                console.log("EM");
                cb(error, stdout, stderr);
            });
        }
    });
}


function runTests() {
}


router.post('/', clearStaging, upload.array('projectFiles'), function (req, res) {
    let isPq = req.body.testType === "pq";
    compileCode(isPq, function (error, stdout, stderr) {
        if(error) {
            res.render("index", {error: error});
            return;
        }
        runTests();
        res.render("index", {errors: {}});
    });
});

router.get('/', function (req, res, next) {
    res.render('index');
});

module.exports = router;
