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


const GCC_COMPILE_PQ = "gcc -g -std=c99 -o staging/compiled_program -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";
const GCC_COMPILE_EM = "gcc -g -std=c99 -o staging/compiled_program -Wall -pedantic-errors -Werror -DNDEBUG staging/*.c";

function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function pullFile(file, cb) {
    exec("wget --no-cache --no-cookies https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename + "?" + Math.random() + " -O staging/" + file.localname, cb);
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
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "PriorityQueue/main.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.c", localname: "test_utilities.c", branch: "PriorityQueue"}
    ];

    var EM_FILES = [
        {remotename: "EventManager/main.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.c", localname: "test_utilities.c", branch: "PriorityQueue"}
    ];
    if (isPq) {
        console.log("SECOND", PQ_FILES);
        updateFiles(PQ_FILES, cb);
    } else {
        updateFiles(EM_FILES, cb);
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
    let fileContent = fs.readFileSync("staging/tests.c");
    var myRegexp = /define NUMBER_TESTS (\d+)/g;
    let match = myRegexp.exec(fileContent);
    let count = parseInt(match[1]);
    return count;
}

function isValgrindFailure(tempLogName) {
    let valgrindOutput = fs.readFileSync("public/" + tempLogName);
    var myRegexp = /ERROR SUMMARY: (\d+) errors/g;
    let match = myRegexp.exec(valgrindOutput);
    try {
        var count = parseInt(match[1]);
    } catch (err) {
        var count = -1;
    }

    if (count >= 1) {
        return count;
    } else if (count === 0) {
        return "SUCCESS";
    } else {
        return "UNKNOWN";
    }
}

function _runTests(testNumber, maxTestsNumber, output, cb) {
    if (testNumber > maxTestsNumber) {
        cb();
        return;
    }

    let tempLogName = `valgrind-test-${testNumber}-${makeid(15)}.out.txt`;

    // const EXEC_TEST_NUMBER = `./staging/compiled_program ${testNumber} > staging/test_${testNumber}_output.txt`;
    const EXEC_TEST_NUMBER = `valgrind --leak-check=full --show-leak-kinds=all --log-file="./public/${tempLogName}" ./staging/compiled_program ${testNumber}`;
    exec(EXEC_TEST_NUMBER, function (error, stdout, stderr) {
        let isValgrindFailureResult = isValgrindFailure(tempLogName);
        let valgrindMessage = "";
        if (isValgrindFailureResult >= 1) {
            valgrindMessage = "Valgrind has found " + isValgrindFailureResult + " error(s), check full output file";
        } else if (isValgrindFailureResult === "UNKNOWN") {
            valgrindMessage = "Valgrind status unknown, please look manually at output file";
        }
        output.push({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage});
        _runTests(testNumber + 1, maxTestsNumber, output, cb);
    });

}

function runTests(cb) {
    let testCount = getTestCount();
    let output = [];
    _runTests(1, testCount, output, function () {
        cb(output);
    });
}


router.post('/', clearStaging, upload.array('projectFiles'), function (req, res) {
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "PriorityQueue/main.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.c", localname: "test_utilities.c", branch: "PriorityQueue"}
    ];

    var EM_FILES = [
        {remotename: "EventManager/main.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.c", localname: "test_utilities.c", branch: "PriorityQueue"}
    ];
    let isPq = req.body.testType === "pq";
    compileCode(isPq, function (error, stdout, stderr) {
        if (error) {
            res.render("index", {error: error, output: [], testPath: ""});
            return;
        }
        runTests(function (output) {
            var testPath;
            if (isPq) {
                let file = PQ_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename;
            } else {
                let file = EM_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename;
            }
            res.render("index", {error: {}, output: output, testPath: testPath});
        });
    });
});

router.get('/', function (req, res, next) {
    res.render('index', {error: {}, output: [], testPath: ""});
});

module.exports = router;
