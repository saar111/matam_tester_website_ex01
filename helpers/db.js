const { MongoClient } = require("mongodb");
const assert = require("assert");

var _db;

module.exports = {
  connect: function( callback ) {
    MongoClient.connect("mongodb://localhost:27017/",  { useNewUrlParser: true }, (err, client) => {
      assert.strictEqual(null, err);
      _db  = client.db("test_counter");
      _db.on("close", function(){
        // throw new Error("DB connection was closed");
      })
      if(callback) {
        return callback(err, _db, client);
      }
    });
  },

  getConnection: function() {
    return _db;
  }
};