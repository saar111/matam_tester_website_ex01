const {MongoClient} = require("mongodb");

function getTestCounter(cb) {
    try {
    MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
		try {
			let _db = client.db("test_counter");
			_db.collection("test_counter").findOne({}, null, (err, test_count) => {
				cb(test_count);
			});
		} catch(err) {
			cb({test_count: 0, runners: []});	
		}
    });
    } catch (err) {
        cb({test_count: 0, runners: []});
    }

}

exports.setLocalsTestCount = function (req, res, next) {
    try {
        getTestCounter((test_count) => {
            res.locals.test_count = test_count.test_count || 0;
            res.locals.runners = test_count.runners || 0;
            next();
        });
    } catch (err) {
        res.locals.test_count = 0;
        res.locals.runners = 0;
        next();
    }
}

exports.add1ToTestCount = function (req, res, next) {
    try {
        MongoClient.connect("mongodb://localhost:27017/", {useNewUrlParser: true}, (err, client) => {
            try {
                getTestCounter((test_count) => {
                    let runners = test_count.runners || [];
                    runners.push(req.query.name);
                    runners = Array.from(new Set(runners));
					try {
						let _db = client.db("test_counter");
						_db.collection("test_counter").updateOne({}, {
							$inc: {"test_count": 1},
							$set: {runners: runners}
						}, (err, test_count) => {
							next();
						});
					} catch(err) {
						next();
					}		
                });
            } catch(err) {
                next();
            }

        });
    } catch (err) {
        next();
    }
}
