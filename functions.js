var bcrypt = require('bcryptjs'),
    Q = require('q'),
    config = require('./config.js'); //config file contains all tokens and other private info

// MongoDB connection information
//var mongodbUrl = 'mongodb://' + config.mongodbHost + ':27017/users';
var dbName = 'myFirstDatabase';
var mongodbUrl = "mongodb+srv://ths:thspassword@cluster0.yxapw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
var MongoClient = require('mongodb').MongoClient

//used in local-signup strategy
exports.localReg = function (username, password) {
  var deferred = Q.defer();

  MongoClient.connect(mongodbUrl, function (err, client) {
    //assert.equal(null, err);
    console.log("Connected successfully to server");
    const db = client.db(dbName);
    var collection = db.collection('localUsers');

    //check if username is already assigned in our database
    collection.findOne({'username' : username})
      .then(function (result) {
        if (null != result) {
          console.log("USERNAME ALREADY EXISTS:", result.username);
          deferred.resolve(false); // username exists
        }
        else  {
          var hash = bcrypt.hashSync(password, 8);
          var user = {
            "username": username,
            "password": hash,
            "avatar": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Beagle_puppy_6_weeks.JPG/800px-Beagle_puppy_6_weeks.JPG"
          }

          console.log("CREATING USER:", username);

          collection.insert(user)
            .then(function () {
              client.close();
              deferred.resolve(user);
            });
        }
      });
  });
  return deferred.promise;
};


//check if user exists
    //if user exists check if passwords match (use bcrypt.compareSync(password, hash); // true where 'hash' is password in DB)
      //if password matches take into website
  //if user doesn't exist or password doesn't match tell them it failed
exports.localAuth = function (username, password) {
  var deferred = Q.defer();
  MongoClient.connect(mongodbUrl, function (err, client) {    
    console.log("Connected successfully to server");
    const db = client.db(dbName);
    var collection = db.collection('localUsers');

    collection.findOne({'username' : username})
      .then(function (result) {
        if (null == result) {
          console.log("USERNAME NOT FOUND:", username);

          deferred.resolve(false);
        }
        else {
          var hash = result.password;
          console.log("FOUND USER: " + result.username);
          if (bcrypt.compareSync(password, hash)) {
            deferred.resolve(result);
          } else {
            console.log("AUTHENTICATION FAILED");
            deferred.resolve(false);
          }
        }
        client.close();
      });
  });
  return deferred.promise;
}