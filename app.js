const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');

const productController = require('./controllers/productController');
const userController = require('./controllers/userController');
const cartController = require('./controllers/cartController');

const db = require('./db');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// view engine, static, body parser
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// auth middlewares
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    res.redirect('/login');
};
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    res.redirect('/shopping');
};

// Routes
app.get('/', (req, res) => res.render('index', { user: req.session.user }));

// Products listing: use productController to fetch and render
app.get('/inventory', checkAuthenticated, checkAdmin, productController.list);
app.get('/shopping', checkAuthenticated, productController.list);

// Registration routes -> delegate to userController.add
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});
app.post('/register', (req, res, next) => userController.add(req, res, next));

// Login (kept here because login flow was previously in app.js)
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/login');
        }
        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful');
            if (req.session.user.role === 'admin') return res.redirect('/inventory');
            return res.redirect('/shopping');
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
    });
});

// Cart routes -> delegate to cartController
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => cartController.addToCart(req, res));
app.get('/cart', checkAuthenticated, (req, res) => cartController.viewCart(req, res));
app.post('/cart/remove/:id', checkAuthenticated, (req, res) => cartController.removeFromCart(req, res));
app.post('/cart/clear', checkAuthenticated, (req, res) => cartController.clearCart(req, res));

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// product page and product CRUD using controller
app.get('/product/:id', checkAuthenticated, productController.getById);
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => res.render('addProduct', { user: req.session.user }));
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), productController.add);
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, productController.renderEdit);
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), productController.update);
// delete product
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, productController.delete);

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));