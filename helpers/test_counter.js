const db = require("./db")


exports.setLocalsTestCount = function (req, res, next) {
    let db = db.getConnection();
    db.collection("test_counter").findOne({}, null, (err, test_count) => {
        res.locals.test_count = test_count.test_count || 0;
        next();
    });
}

exports.add1ToTestCount = function (req, res, next) {
    let db = db.getConnection();
    db.collection("test_counter").updateOne({}, {$inc: {"test_count": 1}}, (err, test_count) => {
    });
    next();
}
