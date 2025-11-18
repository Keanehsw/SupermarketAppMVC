// ...existing code...
const orderModel = require('../models/order');
const orderItemModel = require('../models/orderitem');
const productModel = require('../models/product');
const cartModel = require('../models/cartitem'); // used to clear persisted cart

function renderCheckout(req, res) {
    const cart = req.session.cart || [];
    const total = cart.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    return res.render('checkout', { cart, total: total.toFixed(2), user: req.session.user, messages: req.flash() });
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

    // validate stock sequentially
    const items = [];
    let i = 0;

    function checkNext() {
        if (i >= cart.length) return createOrder();
        const ci = cart[i++];
        productModel.getById(Number(ci.productId), (err, product) => {
            if (err) {
                req.flash('error', 'Database error while validating stock');
                return res.redirect('/cart');
            }
            if (!product) {
                req.flash('error', `Product not found (id ${ci.productId})`);
                return res.redirect('/cart');
            }
            const available = Number(product.quantity) || 0;
            const want = Number(ci.quantity) || 0;
            if (want <= 0) {
                req.flash('error', `Invalid quantity for "${product.ProductName}"`);
                return res.redirect('/cart');
            }
            if (available < want) {
                req.flash('error', `Only ${available} item(s) available for "${product.ProductName}". Please update your cart.`);
                return res.redirect('/cart');
            }
            items.push({
                product,
                quantity: want,
                price: Number(product.price) || 0
            });
            checkNext();
        });
    }

    function createOrder() {
        const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
        orderModel.create(user.id, total, 'pending', (err, created) => {
            if (err) {
                req.flash('error', 'Unable to create order');
                return res.redirect('/cart');
            }
            const orderId = created.id;

            const orderItems = items.map(it => ({
                productId: it.product.id,
                quantity: it.quantity,
                price: it.price
            }));

            orderItemModel.addMany(orderId, orderItems, (err2) => {
                if (err2) {
                    req.flash('error', 'Unable to save order items');
                    return res.redirect('/cart');
                }

                // decrement stock sequentially
                let j = 0;
                function decNext() {
                    if (j >= items.length) return finalize();
                    const it = items[j++];
                    productModel.decrementStock(it.product.id, it.quantity, (decErr) => {
                        if (decErr) console.error('Failed to decrement stock', it.product.id, decErr);
                        decNext();
                    });
                }

                function finalize() {
                    // clear session cart and persisted cart
                    req.session.cart = [];
                    if (user && user.id) {
                        cartModel.clearCartForUser(user.id, (clearErr) => {
                            if (clearErr) console.error('Failed to clear persisted cart after order', clearErr);
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
            return res.render('orders', { orders: orders || [], user, messages: req.flash() });
        });
    } else {
        orderModel.getByUserId(user.id, (err, orders) => {
            if (err) {
                req.flash('error', err.message || err);
                return res.redirect('/');
            }
            return res.render('orders', { orders: orders || [], user, messages: req.flash() });
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
            // Render single order view
            return res.render('order', { order: order, items: items || [], user, messages: req.flash() });
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