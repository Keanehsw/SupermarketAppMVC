const orderModel = require('../models/order');
const orderItemModel = require('../models/orderitem');
const productModel = require('../models/product');
const cartModel = require('../models/cartitem');

/**
 * Render checkout page
 */
function renderCheckout(req, res) {
    const cart = req.session.cart || [];
    const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    return res.render('checkout', { cart, total: total.toFixed(2), user: req.session.user, messages: req.flash() });
}

/**
 * Place order: validate stock, create order + items, decrement stock and clear cart
 */
function placeOrder(req, res) {
    const user = req.session.user;
    const cart = req.session.cart || [];

    if (!user) {
        req.flash('error', 'Please log in to place an order.');
        return res.redirect('/login');
    }
    if (!cart.length) {
        req.flash('error', 'Your cart is empty.');
        return res.redirect('/cart');
    }

    const items = [];
    let i = 0;
    function checkNext() {
        if (i >= cart.length) return createOrder();
        const ci = cart[i++];
        productModel.getById(Number(ci.productId), (err, product) => {
            if (err || !product) {
                req.flash('error', 'Product validation error');
                return res.redirect('/cart');
            }
            const available = Number(product.quantity) || 0;
            const want = Number(ci.quantity) || 0;
            if (want <= 0 || available < want) {
                req.flash('error', `Insufficient stock for "${product.ProductName}"`);
                return res.redirect('/cart');
            }
            items.push({ product, quantity: want, price: Number(product.price) || 0 });
            checkNext();
        });
    }

    function createOrder() {
        const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
        orderModel.create(user.id, total, 'pending', (err, created) => {
            if (err) {
                req.flash('error', 'Failed to create order');
                return res.redirect('/cart');
            }
            const orderId = created.id;
            const orderItems = items.map(it => ({ productId: it.product.id, quantity: it.quantity, price: it.price }));
            orderItemModel.addMany(orderId, orderItems, (err2) => {
                if (err2) {
                    req.flash('error', 'Failed to save order items');
                    return res.redirect('/cart');
                }
                // decrement stock sequentially
                let j = 0;
                function decNext() {
                    if (j >= items.length) return finalize();
                    const it = items[j++];
                    productModel.decrementStock(it.product.id, it.quantity, (decErr) => {
                        if (decErr) console.error('decrementStock error', decErr);
                        decNext();
                    });
                }
                function finalize() {
                    req.session.cart = [];
                    if (user && user.id) {
                        cartModel.clearCartForUser(user.id, (clearErr) => {
                            if (clearErr) console.error('clear persisted cart error', clearErr);
                            req.flash('success', 'Order placed successfully.');
                            return res.redirect(`/orders/${orderId}`);
                        });
                    } else {
                        req.flash('success', 'Order placed successfully.');
                        return res.redirect(`/orders/${orderId}`);
                    }
                }
                decNext();
            });
        });
    }

    checkNext();
}

/**
 * List orders (admin all, user own)
 */
function listOrders(req, res) {
    const user = req.session.user;
    if (!user) {
        req.flash('error', 'Please log in');
        return res.redirect('/login');
    }
    const renderWith = (orders) => res.render('orders', { orders: orders || [], user, messages: req.flash() });
    if (user.role === 'admin') {
        orderModel.getAll((err, orders) => {
            if (err) { req.flash('error', err.message || err); return res.redirect('/'); }
            return renderWith(orders);
        });
    } else {
        orderModel.getByUserId(user.id, (err, orders) => {
            if (err) { req.flash('error', err.message || err); return res.redirect('/'); }
            return renderWith(orders);
        });
    }
}

/**
 * Get single order details
 */
function getOrder(req, res) {
    const id = parseInt(req.params.id, 10);
    const user = req.session.user;
    if (!id) { req.flash('error', 'Invalid order id'); return res.redirect('/orders'); }
    orderModel.getById(id, (err, order) => {
        if (err || !order) { req.flash('error', 'Order not found'); return res.redirect('/orders'); }
        if (user.role !== 'admin' && order.user_id !== user.id) { req.flash('error', 'Access denied'); return res.redirect('/orders'); }
        orderItemModel.getByOrderId(id, (err2, items) => {
            if (err2) { req.flash('error', 'Failed to load order items'); return res.redirect('/orders'); }
            return res.render('order', { order, items: items || [], user, messages: req.flash() });
        });
    });
}

/**
 * Update status (admin)
 */
function updateStatus(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'admin') { req.flash('error', 'Access denied'); return res.redirect('/orders'); }
    const id = parseInt(req.params.id, 10);
    const status = (req.body.status || '').trim();
    if (!id || !status) { req.flash('error', 'Invalid request'); return res.redirect('/orders'); }
    orderModel.updateStatus(id, status, (err) => {
        if (err) req.flash('error', 'Unable to update status'); else req.flash('success', 'Order status updated');
        return res.redirect(`/orders/${id}`);
    });
}

/**
 * Delete order and restore stock (admin)
 */
function deleteOrder(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'admin') { req.flash('error', 'Access denied'); return res.redirect('/orders'); }
    const id = parseInt(req.params.id, 10);
    if (!id) { req.flash('error', 'Invalid request'); return res.redirect('/orders'); }
    orderItemModel.getByOrderId(id, (err, items) => {
        if (err) { req.flash('error', 'Failed to load order items'); return res.redirect('/orders'); }
        let k = 0;
        function restoreNext() {
            if (k >= items.length) return deleteItems();
            const it = items[k++];
            productModel.getById(it.product_id, (pErr, product) => {
                if (!pErr && product) {
                    const newQty = (Number(product.quantity) || 0) + Number(it.quantity || 0);
                    const updateObj = { ProductName: product.ProductName, quantity: newQty, price: product.price, image: product.image };
                    productModel.update(product.id, updateObj, () => restoreNext());
                } else restoreNext();
            });
        }
        function deleteItems() {
            orderItemModel.deleteByOrderId(id, (delErr) => {
                if (delErr) { req.flash('error', 'Failed to delete order items'); return res.redirect('/orders'); }
                orderModel.delete(id, (oErr) => {
                    if (oErr) { req.flash('error', 'Failed to delete order'); return res.redirect('/orders'); }
                    req.flash('success', 'Order deleted and stock restored');
                    return res.redirect('/orders');
                });
            });
        }
        restoreNext();
    });
}

/**
 * userOrderHistory - logged-in user's full history (orders + items)
 */
function userOrderHistory(req, res) {
    const user = req.session.user;
    if (!user) { req.flash('error', 'Please log in'); return res.redirect('/login'); }
    orderModel.getByUserId(user.id, (err, orders) => {
        if (err) { req.flash('error', 'Failed to load orders'); return res.redirect('/'); }
        orders = orders || [];
        let idx = 0;
        function attachNext() {
            if (idx >= orders.length) return res.render('orderHistory', { orders, owner: user, user: req.session.user, messages: req.flash() });
            const o = orders[idx++];
            orderItemModel.getByOrderId(o.id, (e, items) => {
                o.items = items || [];
                attachNext();
            });
        }
        attachNext();
    });
}

/**
 * viewUserOrders - admin can view a specific user's history
 */
function viewUserOrders(req, res) {
    const current = req.session.user;
    if (!current || current.role !== 'admin') { req.flash('error', 'Access denied'); return res.redirect('/shopping'); }
    const userId = parseInt(req.params.id, 10);
    if (!userId) { req.flash('error', 'Invalid user id'); return res.redirect('/users'); }
    orderModel.getByUserId(userId, (err, orders) => {
        if (err) { req.flash('error', 'Failed to load orders'); return res.redirect('/users'); }
        orders = orders || [];
        let idx = 0;
        function attachNext() {
            if (idx >= orders.length) return res.render('orderHistory', { orders, owner: { id: userId }, user: req.session.user, messages: req.flash() });
            const o = orders[idx++];
            orderItemModel.getByOrderId(o.id, (e, items) => {
                o.items = items || [];
                attachNext();
            });
        }
        attachNext();
    });
}

module.exports = {
    renderCheckout,
    placeOrder,
    listOrders,
    getOrder,
    updateStatus,
    deleteOrder,
    userOrderHistory,
    viewUserOrders
};