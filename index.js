var express = require('express');
exphbs = require('express-handlebars'),
logger = require('morgan'),
cookieParser = require('cookie-parser'),
bodyParser = require('body-parser'),
methodOverride = require('method-override'),
session = require('express-session'),
passport = require('passport'),
LocalStrategy = require('passport-local'),
TwitterStrategy = require('passport-twitter'),
GoogleStrategy = require('passport-google'),
FacebookStrategy = require('passport-facebook');


const crypto = require("crypto");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");
const {GridFsStorage} = require("multer-gridfs-storage");
var dbName = 'myFirstDatabase';
const mongoURI = "mongodb+srv://ths:thspassword@cluster0.yxapw.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
var MongoClient = require('mongodb').MongoClient
const mongodb = require('mongodb');
var app=express();
var config = require('./config.js'), //config file contains all tokens and other private info
funct = require('./functions.js'); 
const { CLIENT_RENEG_LIMIT } = require('tls');
const { Stream } = require('stream');



// connection
const conn = mongoose.createConnection(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

var gfs;
conn.once("open", () => {
  // init stream
  gfs = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: "uploads"
  });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          //const filename = buf.toString("hex") + path.extname(file.originalname);
          const filename = file.originalname;
          const fileInfo = {
            filename: filename,
            bucketName: "uploads"
          };
          resolve(fileInfo);
        });
      });
    }
  });  
  const upload = multer({
    storage
  });
  

//===============PASSPORT===============
// Passport session setup.
passport.serializeUser(function(user, done) {
  console.log("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  console.log("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login/"signin" users.
passport.use('local-signin', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        console.log("LOGGED IN AS: " + user.username);
        req.session.success = 'You are successfully logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));
// Use the LocalStrategy within Passport to register/"signup" users.
passport.use('local-signup', new LocalStrategy(
  {passReqToCallback : true}, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localReg(username, password)
    .then(function (user) {
      if (user) {
        console.log("REGISTERED: " + user.username);
        req.session.success = 'You are successfully registered and logged in ' + user.username + '!';
        done(null, user);
      }
      if (!user) {
        console.log("COULD NOT REGISTER");
        req.session.error = 'That username is already in use, please try a different one.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      console.log(err.body);
    });
  }
));

//===============EXPRESS================
// Configure Express
app.use(logger('combined'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'supernova', saveUninitialized: true, resave: true}));
app.use(passport.initialize());
app.use(passport.session());

// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});

// Configure express to use handlebars templates
var hbs = exphbs.create({
    defaultLayout: 'main', //we will be creating this layout shortly
});
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

//===============ROUTES===============
//displays our homepage
  app.get('/', function(req, res){
    
    MongoClient.connect(mongoURI, function (err, client) {        
      console.log("Connected successfully to server");
      const db = client.db(dbName);
      var bucket = new mongodb.GridFSBucket(db,{ bucketName: 'uploads' });  
      let result = [];   
        bucket.find().forEach((element , index)=> {
        result.push(element.filename);  
      }).then(function(){        
        res.render('home', {user: req.user, files: result});
      });
    });
   
  });
  
  app.get('/getfile', function(req, res){
    var filename=req.query.i;
    MongoClient.connect(mongoURI, function (err, client) {        
      console.log("Connected successfully to server");
      const db = client.db(dbName);
      var bucket = new mongodb.GridFSBucket(db,{ bucketName: 'uploads' });  
      var downStream = bucket.openDownloadStreamByName(filename);
      downStream.pipe(res);
    });
  });

  //displays our signup page
  app.get('/signin', function(req, res){
    res.render('signin');
  });
  
  //sends the request through our local signup strategy, and if successful takes user to homepage, otherwise returns then to signin page
  app.post('/local-reg', passport.authenticate('local-signup', {
    successRedirect: '/',
    failureRedirect: '/signin'
    })
  );
  
  //sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
  app.post('/login', passport.authenticate('local-signin', {
    successRedirect: '/',
    failureRedirect: '/signin'
    })
  );
  
  //logs user out of site, deleting them from the session, and returns to homepage
  app.get('/logout', function(req, res){
    var name = req.user.username;
    console.log("LOGGIN OUT " + req.user.username)
    req.logout();
    res.redirect('/');
    req.session.notice = "You have successfully been logged out " + name + "!";
  });

//===============================
app.post("/upload", upload.single("file"), (req, res) => {
  res.redirect("/");
});


const port = process.env.PORT || 3000;  
  app.listen(3000, function () {
    console.log(`Example app listening on port ${port}`);
  });