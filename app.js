const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');

const productController = require('./controllers/productController');
const userController = require('./controllers/userController');
const cartController = require('./controllers/cartController');
const orderController = require('./controllers/orderController');

const cartModel = require('./models/cartitem');
const db = require('./db');

const app = express();

// file upload setup (keeps existing behavior)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'images'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(flash());

// authentication middleware - fixed: allow next() when logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    req.flash('error', 'Please log in to view this resource');
    return res.redirect('/login');
};
const checkAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error', 'Access denied');
    return res.redirect('/shopping');
};

// Routes
app.get('/', (req, res) => res.render('index', { user: req.session.user, messages: req.flash() }));

// product routes
app.get('/inventory', checkAuthenticated, checkAdmin, productController.list);
app.get('/shopping', checkAuthenticated, productController.list);
app.get('/product/:id', checkAuthenticated, productController.getById);
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => res.render('addProduct', { user: req.session.user, messages: req.flash() }));
app.post('/addProduct', checkAuthenticated, checkAdmin, upload.single('image'), productController.add);
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, productController.renderEdit);
app.post('/updateProduct/:id', checkAuthenticated, checkAdmin, upload.single('image'), productController.update);
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, productController.delete);

// user management (admin)
app.get('/users', checkAuthenticated, checkAdmin, userController.list);
app.get('/users/add', checkAuthenticated, checkAdmin, userController.renderAdd);
app.post('/users/add', checkAuthenticated, checkAdmin, userController.add);
app.get('/users/:id', checkAuthenticated, checkAdmin, userController.getById);
app.post('/users/:id', checkAuthenticated, checkAdmin, userController.update);
app.get('/users/delete/:id', checkAuthenticated, checkAdmin, userController.delete);

// register / login
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});
app.post('/register', (req, res, next) => userController.add(req, res, next));

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
            // restore persisted cart for this user
            cartModel.getByUserId(req.session.user.id, (cErr, items) => {
                if (cErr) {
                    console.error('Failed to load saved cart for user', req.session.user.id, cErr);
                    req.session.cart = [];
                } else {
                    req.session.cart = (items || []).map(r => ({
                        productId: r.productId,
                        productName: r.productName,
                        price: Number(r.price) || 0,
                        quantity: Number(r.quantity) || 0,
                        image: r.image
                    }));
                }
                req.flash('success', 'Login successful!');
                // Redirect both admins and users to the home page
                return res.redirect('/');
            });
        } else {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
    });
});

// logout: persist cart then destroy
app.get('/logout', (req, res) => {
    const user = req.session.user;
    const sessionCart = req.session.cart || [];
    if (user && user.id) {
        cartModel.saveCartForUser(user.id, sessionCart, function (err) {
            if (err) console.error('Failed to save cart on logout for user', user.id, err);
            req.session.destroy(() => res.redirect('/'));
        });
    } else {
        req.session.destroy(() => res.redirect('/'));
    }
});

// cart routes
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => cartController.addToCart(req, res));
app.get('/cart', checkAuthenticated, (req, res) => cartController.viewCart(req, res));
app.post('/cart/update/:id', checkAuthenticated, (req, res) => cartController.updateQuantity(req, res));
app.post('/cart/remove/:id', checkAuthenticated, (req, res) => cartController.removeFromCart(req, res));
app.post('/cart/clear', checkAuthenticated, (req, res) => cartController.clearCart(req, res));

// checkout & orders
app.get('/checkout', checkAuthenticated, (req, res) => orderController.renderCheckout(req, res));
app.post('/checkout', checkAuthenticated, (req, res) => orderController.placeOrder(req, res));
app.get('/orders', checkAuthenticated, (req, res) => orderController.listOrders(req, res));
app.get('/orders/:id', checkAuthenticated, (req, res) => orderController.getOrder(req, res));
app.post('/orders/:id/status', checkAuthenticated, (req, res) => orderController.updateStatus(req, res));
app.get('/orders/delete/:id', checkAuthenticated, (req, res) => orderController.deleteOrder(req, res));

// New: logged-in user's order history
app.get('/my-orders', checkAuthenticated, (req, res) => orderController.userOrderHistory(req, res));

// New: admin view of a specific user's order history
app.get('/users/:id/orders', checkAuthenticated, checkAdmin, (req, res) => orderController.viewUserOrders(req, res));

// New: download invoice
app.get('/orders/:id/invoice', checkAuthenticated, (req, res) => orderController.downloadInvoice(req, res));

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));