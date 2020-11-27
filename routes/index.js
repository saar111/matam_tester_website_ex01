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


const GCC_COMPILE_PQ = "gcc -std=c99 -o staging/priority_queue -Wall -pedantic-errors -Werror -DNDEBUG staging/tests_pq.c staging/*.c";
const GCC_COMPILE_EM = "gcc -std=c99 -o staging/event_manager -Wall -pedantic-errors -Werror -DNDEBUG staging/tests_em.c staging/*.c";


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
        if(is_pq) {
            exec(GCC_COMPILE_PQ, function(error, stdout, stderr){
                console.log("PQ");
                cb();
            });
        } else {
            exec(GCC_COMPILE_EM, function(error, stdout, stderr){
                console.log("EM");
                cb();
            });
        }
    });
}


function runTests() {
}


router.post('/', clearStaging, upload.array('projectFiles'), function (req, res) {
    let isPq = req.body.testType === "pq";
    compileCode(isPq, function () {
        runTests();
        res.json(req.files);
    });
});

router.get('/', function (req, res, next) {
    res.render('index');
});

module.exports = router;
