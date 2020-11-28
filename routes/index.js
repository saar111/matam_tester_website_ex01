var express = require('express');
var router = express.Router();
var multer = require('multer');
var fsExtra = require("fs-extra");
var fs = require("fs");
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


const GCC_COMPILE_PQ = "gcc -std=c99 -o staging/compiled_program -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";
const GCC_COMPILE_EM = "gcc -std=c99 -o staging/compiled_program -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";


function pullFile(file, cb) {
    exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename + " -O staging/" + file.localname, cb);
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
        updateFiles([{
            remotename: "PriorityQueue/main.c",
            localname: "tests.c",
            branch: "PriorityQueue"
        }, {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"}], cb);
    } else {
        updateFiles([{
            remotename: "EventManager/main.c",
            localname: "tests.c",
            branch: "PriorityQueue"
        }, {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"}], cb);
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

function getTestCount() {
    let fileContent = fs.readFileSync("/staging/tests.c");
    var myString = "define NUMBER_TESTS 4";
    var myRegexp = /define NUMBER_TESTS (\d+)/g;
    let match = myRegexp.exec(myString);
    let count = parseInt(match[1]);
    return count;
}

function _runTests(testNumber, maxTestsNumber, output) {
    if (testNumber > maxTestsNumber) {
        return;
    }

    const EXEC_TEST_NUMBER = `./staging/compiled_program ${testNumber} > test_${testNumber}_output.txt`;
    exec(EXEC_TEST_NUMBER, function (error, stdout, stderr) {
      _runTests(testNumber + 1, maxTestsNumber, output);
    });

}

function runTests() {
    let testCount = getTestCount();
    let output = [];
    _runTests(1, testCount, output);
    // GET TEST COUNT FROM FILE AND RUN ALL TESTS or use the "invalid test index" error from file
}


router.post('/', clearStaging, upload.array('projectFiles'), function (req, res) {
    let isPq = req.body.testType === "pq";
    compileCode(isPq, function (error, stdout, stderr) {
        if (error) {
            res.render("index", {error: ""});
            return;
        }
        runTests();
        res.render("index", {error: ""});
    });
});

router.get('/', function (req, res, next) {
    res.render('index');
});

module.exports = router;
