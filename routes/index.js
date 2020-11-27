var express = require('express');
var router = express.Router();
var multer = require('multer');
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, '/tmp/my-uploads')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname)
    }
})
var upload = multer({storage: storage});
const {exec} = require('child_process');

let staging_dir = "staging"

function clearStaging() {

}

function pullTests(cb) {

    exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/main/PriorityQueue/main.c -O staging/tests_pq.c", function () {
        exec("wget https://raw.githubusercontent.com/saar111/MTM_EX01/main/EventManager/main.c -O staging/tests_em.c", function () {
            cb();
        });
    });
}

function compileCode(is_pq, cb) {
    pullTests(function(){
        exec("")
    });
}


function runTests() {
}


router.post('/', upload.array('projectFiles'), function (req, res) {
    console.log(req.body. req.query, req.params);
    clearStaging(function () {
        saveFilesToStaging(function () {
            compileCode(function () {
                runTests();
                res.json(req.files);
            });
        });
    });

});

router.get('/', function (req, res, next) {
    res.render('index');
});

module.exports = router;
