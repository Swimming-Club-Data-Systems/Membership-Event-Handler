var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var stripeRouter = require('./routes/stripe');
var stripeInternalRouter = require('./routes/stripe-scds');
var gocardlessRouter = require('./routes/gocardless');
var cronRouter = require('./routes/cron');
var covidRouter = require('./routes/covid');
var attendanceRouter = require('./routes/attendance');
var sendgridRouter = require('./routes/sendgrid');

const pool = require('./common/mysql');
pool.createPool();
// pool.getPool();

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'))
// app.use(express.json());
app.use(express.text({type: '*/*'}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const { expressCspHeader, INLINE, NONE, SELF } = require('express-csp-header');

app.use(expressCspHeader({
  directives: {
    'default-src': [SELF],
    'script-src': [SELF],
    'style-src': [SELF],
    'img-src': [SELF],
    'worker-src': [SELF],
    'block-all-mixed-content': true
  }
}));

app.use('/', indexRouter);
app.use('/cron', cronRouter);
app.use('/stripe', stripeRouter);
app.use('/stripe-scds', stripeInternalRouter);
app.use('/gocardless', gocardlessRouter);
app.use('/covid', covidRouter);
app.use('/attendance', attendanceRouter);
// app.use('/sendgrid', sendgridRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  res.status(404);
  res.json({ error: 'Not found' });

  // next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
