const db = require("./db").getConnection();
const { MongoClient } = require("mongodb");


exports.setLocalsTestCount = function (req, res, next) {
    MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
        let _db = client.db("test_counter");
        _db.collection("test_counter").findOne({}, null, (err, test_count) => {
            res.locals.test_count = test_count.test_count || 0;
            next();
        });
    });
}

exports.add1ToTestCount = function (req, res, next) {
    MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
        let _db = client.db("test_counter");
        _db.collection("test_counter").updateOne({}, {$inc: {"test_count": 1}}, (err, test_count) => {
        });
        next();
    });
}
