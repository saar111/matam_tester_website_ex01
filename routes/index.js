var express = require('express');
var router = express.Router();
var multer = require('multer');
var fsExtra = require("fs-extra");
var fs = require("fs");
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "staging/" + req.stagingId + "/");
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

function pullFile(file, stagingId, cb) {
    exec("wget --no-cache --no-cookies https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename + "?" + Math.random() + ` -O staging/${stagingId}/` + file.localname, cb);
}

function updateFiles(files, stagingId, cb) {
    if (files.length === 0) {
        return cb();
    }
    pullFile(files[0], stagingId, function () {
        files.splice(0, 1);
        updateFiles(files, stagingId, cb);
    })
}

function createStagingFolder(req, res, next) {
    let stagingId = makeid(14);
    fs.mkdirSync("staging/" + stagingId);
    req.stagingId = stagingId;
    next();
}


function pullTests(testType, stagingId, cb) {
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "PriorityQueue/tests.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"}
    ];
    var EM_FILES = [
        {remotename: "EventManager/tests.c", localname: "tests.c", branch: "EventManager"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "EventManager"}
    ];
    var DATE_FILES = [
        {remotename: "EventManager/date_tests.c", localname: "date_tests.c", branch: "EventManager"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "EventManager"}
    ];

    if (testType === "pq") {
        updateFiles(PQ_FILES, stagingId, cb);
    } else if(testType === "em"){
        updateFiles(EM_FILES, stagingId, cb);
    } else {
        updateFiles(DATE_FILES, stagingId, cb);
    }
}

function compileCode(testType, stagingId, cb) {
    const GCC_COMPILE_TEMPLATE = `gcc -g -std=c99 -o staging/${stagingId}/compiled_program -Wall -pedantic-errors -Werror staging/${stagingId}/*.c`;
    const GCC_COMPILE_EM = `gcc -g -std=c99 -o staging/${stagingId}/compiled_program -Wall -pedantic-errors -Werror staging/${stagingId}/*.c`;
    pullTests(testType, stagingId, function () {
        if (testType === "em") {
            exec(GCC_COMPILE_TEMPLATE, function (error, stdout, stderr) {
                cb(error, stdout, stderr);
            });
        } else {
            exec(GCC_COMPILE_TEMPLATE, function (error, stdout, stderr) {
                cb(error, stdout, stderr);
            });
        }
    });
}

function getTestCount(stagingId) {
    let fileContent = fs.readFileSync(`staging/${stagingId}/tests.c`);
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

function execShellCommand(cmd) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, {timeout: (1000 * 10)}, (error, stdout, stderr) => {
            resolve([error, stdout, stderr]);
        });
    });
}

function _runTests(testNumber, maxTestsNumber, stagingId, output, cb) {
    if (testNumber > maxTestsNumber) {
        cb();
        return;
    }


    let tempLogName = `valgrind-test-${testNumber}-${makeid(15)}.out.txt`;
    const EXEC_TEST_NUMBER = `valgrind --leak-check=full --show-leak-kinds=all --log-file="./public/${tempLogName}" ./staging/${stagingId}/compiled_program ${testNumber}`;
    exec(EXEC_TEST_NUMBER, {timeout: (1000 * 10)}, function (error, stdout, stderr) {
        if (!error) {
            let isValgrindFailureResult = isValgrindFailure(tempLogName);
            let valgrindMessage = "";
            if (isValgrindFailureResult >= 1) {
                valgrindMessage = "<b>Valgrind</b> has found " + isValgrindFailureResult + " error(s), check full output file";
            } else if (isValgrindFailureResult === "UNKNOWN") {
                valgrindMessage = "<b>Valgrind</b> status unknown, please look manually at output file";
            }
            output.push({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage});
        } else {
            output.push({
                testOutput: stdout + "\n\nTest timed out, maybe you have an Infinite Loop",
                valgrindOutputPath: "/" + tempLogName,
                valgrindMessage: ""
            });
        }
        _runTests(testNumber + 1, maxTestsNumber, stagingId, output, cb);
    });

}

function runTests(stagingId, cb) {
    let tempLogName = `valgrind-test-${makeid(15)}.out.txt`;
    const EXEC_TEST_NUMBER = `valgrind --leak-check=full --show-leak-kinds=all --log-file="./public/${tempLogName}" ./staging/${stagingId}/compiled_program`;
    exec(EXEC_TEST_NUMBER, {timeout: (1000 * 40)}, function (error, stdout, stderr) {
        let isValgrindFailureResult = isValgrindFailure(tempLogName);
        let valgrindMessage = "";
        if (isValgrindFailureResult >= 1) {
            valgrindMessage = "<b>Valgrind</b> has found " + isValgrindFailureResult + " error(s), check full output file";
        } else if (isValgrindFailureResult === "UNKNOWN") {
            valgrindMessage = "<b>Valgrind</b> status unknown, please look manually at output file";
        }
        if (!error) {
            let isValgrindFailureResult = isValgrindFailure(tempLogName);
            let valgrindMessage = "";
            if (isValgrindFailureResult >= 1) {
                valgrindMessage = "<b>Valgrind</b> has found " + isValgrindFailureResult + " error(s), check full output file";
            } else if (isValgrindFailureResult === "UNKNOWN") {
                valgrindMessage = "<b>Valgrind</b> status unknown, please look manually at output file";
            }

            cb([({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage})]);
        } else {
            exec("ps -ef | grep valgrind.bin | grep -v grep | awk '{print $2}' | xargs kill", function () {
                cb([({
                    testOutput: stdout + "<br><b class='valgrind-failure'>The testing has encountered an error that has stopped the code from running further.</b><br>" +
                        "Error details: " + error + "<br>" +
                        "More Details: " + (stderr || "None") + "<br>" +
                        "<b>Another possibility is that you have an infinite loop in your code and the testing timed out, if the error details are empty that is probably the case.</b>",
                    // testOutput: stdout + stderr + "<b class='valgrind-failure'>Test timed out, you probably have an infinite Loop in your code.<br>" +
                    //     " Further tests cannot be run, try running the tests once more and if it doesn't work, look for an infinite loop.</b><br>",
                    valgrindOutputPath: "/" + tempLogName,
                    valgrindMessage: valgrindMessage
                })]);
            });
        }
    });


    /*
        let testCount = getTestCount(stagingId);
        let output = [];
        _runTests(1, testCount, stagingId, output, function () {
            cb(output);
        });
    */

    /*
        let execs = [];
        for (let testNumber = 1; testNumber <= testCount; testNumber++) {
            let tempLogName = `valgrind-test-${testNumber}-${makeid(15)}.out.txt`;
            const EXEC_TEST_NUMBER = `valgrind --leak-check=full --show-leak-kinds=all --log-file="./public/${tempLogName}" ./staging/${stagingId}/compiled_program ${testNumber}`;
            let currentExec = execShellCommand(EXEC_TEST_NUMBER);
            currentExec.then((data) => {
                let error = data[0];
                let stdout = data[1];
                let stderr = data[2];
                if (!error) {
                    let isValgrindFailureResult = isValgrindFailure(tempLogName);
                    let valgrindMessage = "";
                    if (isValgrindFailureResult >= 1) {
                        valgrindMessage = "<b>Valgrind</b> has found " + isValgrindFailureResult + " error(s), check full output file";
                    } else if (isValgrindFailureResult === "UNKNOWN") {
                        valgrindMessage = "<b>Valgrind</b> status unknown, please look manually at output file";
                    }
                    return ({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage});
                } else {
                    return ({
                        testOutput: stdout + "\n\nTest timed out, maybe you have an Infinite Loop",
                        valgrindOutputPath: "/" + tempLogName,
                        valgrindMessage: ""
                    });
                }
            });
            execs.push(currentExec);
        }

        Promise.all(execs).then((output) => {
            console.log("OUTPUT: ", output);
            cb(output);
        });
    */
}


router.post('/', createStagingFolder, upload.array('projectFiles'), function (req, res) {
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "PriorityQueue/tests.c", localname: "tests.c", branch: "PriorityQueue"},
        {remotename: "PriorityQueue/test_utilities.h", localname: "test_utilities.h", branch: "PriorityQueue"}
    ];
    var EM_FILES = [
        {remotename: "EventManager/tests.c", localname: "tests.c", branch: "EventManager"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "EventManager"}
    ];
    var DATE_FILES = [
        {remotename: "EventManager/date_tests.c", localname: "date_tests.c", branch: "EventManager"},
        {remotename: "EventManager/test_utilities.h", localname: "test_utilities.h", branch: "EventManager"}
    ];

    let testType = req.body.testType;
    compileCode(testType, req.stagingId, function (error, stdout, stderr) {
        if (error) {
            res.render("index", {error: error, output: [], testPath: ""});
            return;
        }
        runTests(req.stagingId, function (output) {
            var testPath
            if (testType === "pq") {
                let file = PQ_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename;
            } else if(testType === "em"){
                let file = EM_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01/" + file.branch + "/" + file.remotename;
            } else {
                let file = DATE_FILES[0];
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
