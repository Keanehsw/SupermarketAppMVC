const productModel = require('../models/product');

function ensureCart(req) {
    if (!req.session.cart) req.session.cart = [];
    return req.session.cart;
}

/**
 * Render cart page with items and total price.
 */
function viewCart(req, res) {
    try {
        const cart = ensureCart(req);
        const total = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
        res.render('cart', { cart, total: total.toFixed(2), user: req.session.user, messages: req.flash() });
    } catch (err) {
        req.flash('error', err.message || 'Unable to load cart');
        return res.redirect('/shopping');
    }
}

/**
 * Add product to cart. Expects :id param and body.quantity (optional).
 * Uses productModel.getById to fetch product details.
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

        const cart = ensureCart(req);
        const existing = cart.find(i => Number(i.productId) === Number(product.id));
        if (existing) {
            existing.quantity = Number(existing.quantity) + qty;
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
        return res.redirect('/cart');
    });
}

/**
 * Remove a single product from cart by productId (param :id)
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
        return res.redirect('/cart');
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
        return res.redirect('/cart');
    } catch (err) {
        req.flash('error', err.message || 'Unable to clear cart');
        return res.redirect('/cart');
    }
}

module.exports = {
    viewCart,
    addToCart,
    removeFromCart,
    clearCart
};