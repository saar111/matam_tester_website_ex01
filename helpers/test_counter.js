const {MongoClient} = require("mongodb");

function getTestCounter(cb) {
    MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
        let _db = client.db("test_counter");
        _db.collection("test_counter").findOne({}, null, (err, test_count) => {
            cb(test_count);
        });
    });
}

exports.setLocalsTestCount = function (req, res, next) {
    getTestCounter((test_count) => {
        res.locals.test_count = test_count.test_count || 0;
        res.locals.runners = test_count.runners || 0;
        next();
    });
}

exports.add1ToTestCount = function (req, res, next) {
    MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
        getTestCounter((test_count) => {
            let runners = test_count.runners || [];
            runners.push(req.query.name);
            runners = Array.from(new Set(runners));

            let _db = client.db("test_counter");
            _db.collection("test_counter").updateOne({}, {
                $inc: {"test_count": 1},
                $set: {runners: runners}
            }, (err, test_count) => {
            });
        });

        next();
    });
}
