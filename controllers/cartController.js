// ...existing code...
const productModel = require('../models/product');
const cartModel = require('../models/cartitem');

function ensureCart(req) {
    if (!req.session.cart) req.session.cart = [];
    return req.session.cart;
}

function persistIfLoggedIn(req, callback) {
    if (req.session.user && req.session.user.id) {
        // save current session cart to DB; swallow errors but log
        cartModel.saveCartForUser(req.session.user.id, req.session.cart || [], function (err) {
            if (err) console.error('Failed to persist cart for user', req.session.user.id, err);
            if (typeof callback === 'function') callback(err);
        });
    } else if (typeof callback === 'function') {
        callback(null);
    }
}

/**
 * Render cart page with items and total price.
 */
function viewCart(req, res) {
    try {
        const cart = ensureCart(req);
        const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
        return res.render('cart', { cart, total: total.toFixed(2), user: req.session.user, messages: req.flash() });
    } catch (err) {
        req.flash('error', err.message || 'Unable to load cart');
        return res.redirect('/shopping');
    }
}

/**
 * Add product to cart with stock checking.
 */
function addToCart(req, res) {
    const productId = parseInt(req.params.id, 10);
    const qty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    if (!productId || productId <= 0) {
        req.flash('error', 'Invalid product id');
        return res.redirect('/shopping');
    }

    productModel.getById(productId, function (err, product) {
        if (err) {
            req.flash('error', err.message || 'Database error while fetching product');
            return res.redirect('/shopping');
        }
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/shopping');
        }

        const available = Number(product.quantity) || 0;
        const cart = ensureCart(req);
        const existing = cart.find(i => Number(i.productId) === Number(product.id));
        const existingQty = existing ? Number(existing.quantity) : 0;
        const maxCanAdd = Math.max(0, available - existingQty);

        if (available <= 0) {
            req.flash('error', `${product.ProductName || 'Product'} is out of stock`);
            return res.redirect('/shopping');
        }

        if (maxCanAdd <= 0) {
            req.flash('error', `Only ${available} item(s) available for "${product.ProductName}". You already have ${existingQty} in your cart.`);
            return res.redirect('/shopping');
        }

        if (qty > maxCanAdd) {
            // add only what's available and inform the user
            if (existing) {
                existing.quantity = existingQty + maxCanAdd;
            } else {
                cart.push({
                    productId: product.id,
                    productName: product.ProductName || product.productName || 'Unnamed',
                    price: Number(product.price) || 0,
                    quantity: maxCanAdd,
                    image: product.image || null
                });
            }
            req.flash('error', `Only ${available} item(s) available for "${product.ProductName}". Added ${maxCanAdd} (maximum available).`);
            // persist then redirect
            return persistIfLoggedIn(req, () => res.redirect('/cart'));
        }

        // enough stock for requestedQty
        if (existing) {
            existing.quantity = existingQty + qty;
        } else {
            cart.push({
                productId: product.id,
                productName: product.ProductName || product.productName || 'Unnamed',
                price: Number(product.price) || 0,
                quantity: qty,
                image: product.image || null
            });
        }

        req.flash('success', `${product.ProductName || 'Product'} added to cart`);
        persistIfLoggedIn(req, () => res.redirect('/cart'));
    });
}

/**
 * Update quantity in cart with stock checking.
 * If requested quantity is 0 → remove item.
 * If requested quantity exceeds available stock → set to available and notify user.
 */
function updateQuantity(req, res) {
    const productId = parseInt(req.params.id, 10);
    let requestedQty = parseInt(req.body.quantity, 10);

    if (!productId || productId <= 0 || isNaN(requestedQty)) {
        req.flash('error', 'Invalid request');
        return res.redirect('/cart');
    }

    requestedQty = Math.max(0, requestedQty);

    // fetch latest product stock
    productModel.getById(productId, function (err, product) {
        if (err) {
            req.flash('error', err.message || 'Database error while checking stock');
            return res.redirect('/cart');
        }
        if (!product) {
            req.flash('error', 'Product not found');
            return res.redirect('/cart');
        }

        const available = Number(product.quantity) || 0;
        const cart = ensureCart(req);
        const idx = cart.findIndex(i => Number(i.productId) === productId);

        if (idx === -1) {
            req.flash('error', 'Item not found in cart');
            return res.redirect('/cart');
        }

        if (requestedQty === 0) {
            cart.splice(idx, 1);
            req.flash('success', 'Item removed from cart');
            return persistIfLoggedIn(req, () => res.redirect('/cart'));
        }

        if (requestedQty > available) {
            // set to available
            cart[idx].quantity = available;
            req.flash('error', `Only ${available} item(s) available for "${product.ProductName}". Quantity adjusted to ${available}.`);
            return persistIfLoggedIn(req, () => res.redirect('/cart'));
        }

        // OK to set requestedQty
        cart[idx].quantity = requestedQty;
        req.flash('success', 'Quantity updated');
        persistIfLoggedIn(req, () => res.redirect('/cart'));
    });
}

/**
 * Remove a single product from cart by productId
 */
function removeFromCart(req, res) {
    const productId = parseInt(req.params.id, 10);
    if (!productId || productId <= 0) {
        req.flash('error', 'Invalid product id');
        return res.redirect('/cart');
    }

    try {
        const cart = ensureCart(req);
        const idx = cart.findIndex(i => Number(i.productId) === productId);
        if (idx === -1) {
            req.flash('error', 'Item not found in cart');
            return res.redirect('/cart');
        }
        cart.splice(idx, 1);
        req.flash('success', 'Item removed from cart');
        return persistIfLoggedIn(req, () => res.redirect('/cart'));
    } catch (err) {
        req.flash('error', err.message || 'Unable to remove item from cart');
        return res.redirect('/cart');
    }
}

/**
 * Clear entire cart
 */
function clearCart(req, res) {
    try {
        req.session.cart = [];
        req.flash('success', 'Cart cleared');
        // persist clear for logged-in user
        return persistIfLoggedIn(req, () => res.redirect('/cart'));
    } catch (err) {
        req.flash('error', err.message || 'Unable to clear cart');
        return res.redirect('/cart');
    }
}

module.exports = {
    viewCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart
};
// ...existing code...