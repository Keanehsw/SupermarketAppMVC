// ...existing code...
const orderModel = require('../models/order');
const orderItemModel = require('../models/orderitem');
const productModel = require('../models/product');

function renderCheckout(req, res) {
    const cart = req.session.cart || [];
    const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    res.render('checkout', { cart, total: total.toFixed(2), user: req.session.user, messages: req.flash() });
}

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

    // Step 1: fetch latest product info for each cart item and check stock
    const items = [];
    let i = 0;

    function fetchNext() {
        if (i >= cart.length) return onAllFetched();
        const ci = cart[i++];
        productModel.getById(Number(ci.productId), (err, product) => {
            if (err) {
                req.flash('error', err.message || 'DB error checking product stock');
                return res.redirect('/cart');
            }
            if (!product) {
                req.flash('error', `Product not found: id ${ci.productId}`);
                return res.redirect('/cart');
            }
            const available = Number(product.quantity) || 0;
            const want = Number(ci.quantity) || 0;
            if (available <= 0) {
                req.flash('error', `${product.ProductName || 'Product'} is out of stock`);
                return res.redirect('/cart');
            }
            if (want > available) {
                req.flash('error', `Only ${available} "${product.ProductName}" available. Please update your cart.`);
                return res.redirect('/cart');
            }
            items.push({
                product,
                quantity: want,
                price: Number(product.price) || 0
            });
            fetchNext();
        });
    }

    function onAllFetched() {
        // Step 2: create order
        const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
        orderModel.create(user.id, total, 'pending', (err, created) => {
            if (err) {
                req.flash('error', err.message || 'Unable to create order');
                return res.redirect('/cart');
            }
            const orderId = created.id;
            // Step 3: create order items (bulk insert)
            const orderItems = items.map(it => ({
                productId: it.product.id,
                quantity: it.quantity,
                price: it.price
            }));
            orderItemModel.addMany(orderId, orderItems, (err2) => {
                if (err2) {
                    req.flash('error', err2.message || 'Unable to create order items');
                    return res.redirect('/cart');
                }
                // Step 4: decrement product stock sequentially
                let j = 0;
                function decNext() {
                    if (j >= items.length) {
                        // done: clear cart and redirect to order page
                        req.session.cart = [];
                        req.flash('success', 'Order placed successfully.');
                        return res.redirect(`/orders/${orderId}`);
                    }
                    const it = items[j++];
                    const newQty = Math.max(0, Number(it.product.quantity) - Number(it.quantity));
                    const updateObj = {
                        ProductName: it.product.ProductName,
                        quantity: newQty,
                        price: it.product.price,
                        image: it.product.image
                    };
                    productModel.update(it.product.id, updateObj, (upErr) => {
                        if (upErr) {
                            // log and continue; but inform admin later
                            console.error('Failed to decrement stock for product', it.product.id, upErr);
                        }
                        decNext();
                    });
                }
                decNext();
            });
        });
    }

    fetchNext();
}

function listOrders(req, res) {
    const user = req.session.user;
    if (!user) {
        req.flash('error', 'Please log in');
        return res.redirect('/login');
    }
    if (user.role === 'admin') {
        orderModel.getAll((err, orders) => {
            if (err) {
                req.flash('error', err.message || err);
                return res.redirect('/');
            }
            return res.render('orders', { orders, user, messages: req.flash() });
        });
    } else {
        orderModel.getByUserId(user.id, (err, orders) => {
            if (err) {
                req.flash('error', err.message || err);
                return res.redirect('/');
            }
            return res.render('orders', { orders, user, messages: req.flash() });
        });
    }
}

function getOrder(req, res) {
    const id = parseInt(req.params.id, 10);
    const user = req.session.user;
    if (!id) {
        req.flash('error', 'Invalid order id');
        return res.redirect('/orders');
    }
    orderModel.getById(id, (err, order) => {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/orders');
        }
        if (!order) {
            req.flash('error', 'Order not found');
            return res.redirect('/orders');
        }
        // access control
        if (user.role !== 'admin' && order.user_id !== user.id) {
            req.flash('error', 'Access denied');
            return res.redirect('/orders');
        }
        orderItemModel.getByOrderId(id, (err2, items) => {
            if (err2) {
                req.flash('error', err2.message || err2);
                return res.redirect('/orders');
            }
            return res.render('orders', { order, items, user, messages: req.flash() });
        });
    });
}

function updateStatus(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        req.flash('error', 'Access denied');
        return res.redirect('/orders');
    }
    const id = parseInt(req.params.id, 10);
    const status = (req.body.status || '').trim();
    if (!id || !status) {
        req.flash('error', 'Invalid request');
        return res.redirect('/orders');
    }
    orderModel.updateStatus(id, status, (err) => {
        if (err) {
            req.flash('error', err.message || err);
        } else {
            req.flash('success', 'Order status updated');
        }
        return res.redirect(`/orders/${id}`);
    });
}

function deleteOrder(req, res) {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        req.flash('error', 'Access denied');
        return res.redirect('/orders');
    }
    const id = parseInt(req.params.id, 10);
    if (!id) {
        req.flash('error', 'Invalid request');
        return res.redirect('/orders');
    }
    // restore stock then delete items and order
    orderItemModel.getByOrderId(id, (err, items) => {
        if (err) {
            req.flash('error', err.message || err);
            return res.redirect('/orders');
        }
        // sequentially restore stock
        let k = 0;
        function restoreNext() {
            if (k >= items.length) return deleteItems();
            const it = items[k++];
            productModel.getById(it.product_id, (pErr, product) => {
                if (!pErr && product) {
                    const newQty = (Number(product.quantity) || 0) + Number(it.quantity || 0);
                    const updateObj = {
                        ProductName: product.ProductName,
                        quantity: newQty,
                        price: product.price,
                        image: product.image
                    };
                    productModel.update(product.id, updateObj, () => restoreNext());
                } else {
                    restoreNext();
                }
            });
        }
        function deleteItems() {
            orderItemModel.deleteByOrderId(id, (delErr) => {
                if (delErr) {
                    req.flash('error', delErr.message || delErr);
                    return res.redirect('/orders');
                }
                orderModel.delete(id, (oErr) => {
                    if (oErr) {
                        req.flash('error', oErr.message || oErr);
                        return res.redirect('/orders');
                    }
                    req.flash('success', 'Order deleted and stock restored');
                    return res.redirect('/orders');
                });
            });
        }
        restoreNext();
    });
}

module.exports = {
    renderCheckout,
    placeOrder,
    listOrders,
    getOrder,
    updateStatus,
    deleteOrder
};
// ...existing code...