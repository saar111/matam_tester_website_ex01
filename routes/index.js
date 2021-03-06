var express = require('express');
var router = express.Router();
var multer = require('multer');
var fsExtra = require("fs-extra");
var fs = require("fs");
const tc = require("../helpers/test_counter");

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
    exec("wget --no-cache --no-cookies https://raw.githubusercontent.com/saar111/MTM_EX01_TESTS/" + file.branch + "/" + file.remotename + "?" + Math.random() + ` -O staging/${stagingId}/` + file.localname, cb);
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
    let sanitizedName = req.query.name.replace(/\W/g, '')
    let stagingId = makeid(14) + "-" + sanitizedName;
    fs.mkdirSync(`staging/` + stagingId);
    req.stagingId = stagingId;
    next();
}


function pullTests(testType, stagingId, cb) {
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "pq_tests.c", localname: "tests.c", branch: "master"},
        {remotename: "pq_test_utilities.h", localname: "test_utilities.h", branch: "master"}
    ];
    var EM_FILES = [
        {remotename: "em_tests.c", localname: "tests.c", branch: "master"},
        {remotename: "priority_queue.h", localname: "priority_queue.h", branch: "master"},
        {remotename: "priority_queue.c", localname: "priority_queue.c", branch: "master"},
        {remotename: "double_linked_list.c", localname: "double_linked_list.c", branch: "master"},
        {remotename: "double_linked_list.h", localname: "double_linked_list.h", branch: "master"},
    ];
    var EM_PQ_FILES = [
        {remotename: "em_tests.c", localname: "tests.c", branch: "master"},
    ];
    var DATE_FILES = [
        {remotename: "date_tests.c", localname: "date_tests.c", branch: "master"},
        {remotename: "em_test_utilities.h", localname: "test_utilities.h", branch: "master"}
    ];

    if (testType === "pq") {
        updateFiles(PQ_FILES, stagingId, cb);
    } else if (testType === "em") {
        updateFiles(EM_FILES, stagingId, cb);
    } else if (testType === "date") {
        updateFiles(DATE_FILES, stagingId, cb);
    } else if (testType === "em-pq") {
        updateFiles(EM_PQ_FILES, stagingId, cb);
    }
}

function compileCode(testType, stagingId, cb) {
    const GCC_COMPILE_TEMPLATE = `gcc -g -std=c99 -o staging/${stagingId}/compiled_program -Wall -pedantic-errors -Werror staging/${stagingId}/*.c`;
    const GCC_COMPILE_EM_ALONE = `gcc -g -std=c99 -o staging/${stagingId}/compiled_program -Wall -pedantic-errors -Werror -Lstaging -llibpriority_queue.a staging/${stagingId}/*.c`;
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
    try {
        var valgrindOutput = fs.readFileSync("./public/" + tempLogName);
    } catch(err) {
        return "UNKNOWN";
    }
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

function execShellCommand(cmd, stagingId) {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, {timeout: (1000 * 7), cwd: `./staging/${stagingId}`}, (error, stdout, stderr) => {
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
    const EXEC_TEST_NUMBER = `valgrind --leak-check=full --show-leak-kinds=all --log-file="../../public/${tempLogName}" ./staging/${stagingId}/compiled_program ${testNumber}`;
    exec(EXEC_TEST_NUMBER, {timeout: (1000 * 10), cwd: `./staging/${stagingId}`}, function (error, stdout, stderr) {
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
    const EXEC_TEST_NUMBER = `nice valgrind --max-stackframe=800000 --leak-check=full --show-leak-kinds=all --log-file="../../public/${tempLogName}" ./compiled_program`;
    exec(EXEC_TEST_NUMBER, {timeout: (1000 * 7), cwd: `./staging/${stagingId}`}, function (error, stdout, stderr) {
        let isValgrindFailureResult = isValgrindFailure(tempLogName);
        let valgrindMessage = "";
        if (isValgrindFailureResult >= 1) {
            valgrindMessage = "<b>Valgrind</b> has found " + isValgrindFailureResult + " error(s), check full output file";
        } else if (isValgrindFailureResult === "UNKNOWN") {
            valgrindMessage = "<b>Valgrind</b> status unknown, please look manually at output file";
        }

        if (!error) {
			if(Math.random() < 0.3) {
				exec("ps -ef | grep valgrind.bin | grep -v grep | awk '{print $2}' | xargs kill", function () {
					cb([({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage})]);
				});
			} else {
				cb([({testOutput: stdout, valgrindOutputPath: "/" + tempLogName, valgrindMessage: valgrindMessage})]);
			}
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
}


router.post('/ex01', tc.add1ToTestCount, tc.setLocalsTestCount, createStagingFolder, upload.array('projectFiles'), function (req, res) {
    let bannedNames = [];
    let bannedIps = [];


    try {
        console.log(`POST request received: name: ${req.query.name}, IP: ${req.connection.remoteAddress}`);
    } catch(err) {
        console.log(`POST request received: IP: ${req.connection.remoteAddress}`);
    }
    if(bannedNames.includes(req.query.name) || bannedIps.includes(req.connection.remoteAddress)) {
        res.send("Talk to me in private in Whatsapp, you are crashing the site! 052-3487450");
        return;
    }
    // REMEMBER TO UPDATE IN THE OTHER PLACE (DOWN THIS FILE)
    var PQ_FILES = [
        {remotename: "pq_tests.c", localname: "tests.c", branch: "master"},
        {remotename: "pq_test_utilities.h", localname: "test_utilities.h", branch: "master"}
    ];
    var EM_FILES = [
        {remotename: "em_tests.c", localname: "tests.c", branch: "master"},
        {remotename: "priority_queue.h", localname: "priority_queue.h", branch: "master"},
        {remotename: "priority_queue.c", localname: "priority_queue.c", branch: "master"},
        {remotename: "double_linked_list.c", localname: "double_linked_list.c", branch: "master"},
        {remotename: "double_linked_list.h", localname: "double_linked_list.h", branch: "master"},
    ];
    var EM_PQ_FILES = [
        {remotename: "em_tests.c", localname: "tests.c", branch: "master"},
    ];
    var DATE_FILES = [
        {remotename: "date_tests.c", localname: "date_tests.c", branch: "master"},
        {remotename: "em_test_utilities.h", localname: "test_utilities.h", branch: "master"}
    ];

    let testType = req.body.testType;
    compileCode(testType, req.stagingId, function (error, stdout, stderr) {
        if (error) {
            res.render("ex01", {error: error, output: [], testPath: "", stagingId: req.stagingId});
            return;
        }
        runTests(req.stagingId, function (output) {
            var testPath
            if (testType === "pq") {
                let file = PQ_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01_TESTS/" + file.branch + "/" + file.remotename;
            } else if (testType === "em") {
                let file = EM_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01_TESTS/" + file.branch + "/" + file.remotename;
            } else if (testType === "date") {
                let file = DATE_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01_TESTS/" + file.branch + "/" + file.remotename;
            } else if (testType === "em-pq") {
                let file = EM_PQ_FILES[0];
                testPath = "https://raw.githubusercontent.com/saar111/MTM_EX01_TESTS/" + file.branch + "/" + file.remotename;
            }
            res.render("ex01", {error: {}, output: output, testPath: testPath, stagingId: req.stagingId});
        });
    });
});

router.get('/ex01', tc.setLocalsTestCount, function (req, res, next) {
    res.render('ex01', {error: {}, output: [], testPath: "", stagingId: ""});
});

router.get("/", tc.setLocalsTestCount, function(req, res) {
    // res.render("index");
    res.render("index");
    // res.redirect("/ex02");
})


router.use("/ex02", require("./ex02"));

module.exports = router;
