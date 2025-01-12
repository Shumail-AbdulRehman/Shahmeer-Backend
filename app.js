
var exphbs = require('express-handlebars');


var createError = require('http-errors');
var express = require('express');

var path = require('path');


var cookieParser = require('cookie-parser');
var logger = require('morgan');

var db = require('./database/database');
var cors = require('cors');


require('dotenv').config();


var indexRouter = require('./routes/index');

var usersRouter = require('./routes/users');
var videoRouter = require('./routes/video');

var app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: 'https://shahmeer-project.netlify.app/' }));

app.use('/', indexRouter);
app.use('/auth/user', usersRouter);
app.use('/users', usersRouter);
app.use('/video', videoRouter);

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
