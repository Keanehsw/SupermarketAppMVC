const db = require('../db');

/**
 * Get saved cart items for a user.
 * Returns rows with fields: productId, productName, price, quantity, image
 */
function getByUserId(userId, callback) {
    const sql = 'SELECT product_id AS productId, productName, price, quantity, image FROM cart_items WHERE user_id = ?';
    db.query(sql, [userId], function (err, results) {
        if (err) return callback(err);
        return callback(null, results || []);
    });
}

/**
 * Delete all saved cart items for a user.
 */
function clearCartForUser(userId, callback) {
    const sql = 'DELETE FROM cart_items WHERE user_id = ?';
    db.query(sql, [userId], function (err, results) {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

/**
 * Save entire cart for a user (replace existing).
 * cart is an array of items: { productId, productName, price, quantity, image }
 */
function saveCartForUser(userId, cart, callback) {
    // remove existing first
    clearCartForUser(userId, function (err) {
        if (err) return callback(err);
        if (!Array.isArray(cart) || cart.length === 0) return callback(null);
        const values = [];
        const placeholders = cart.map(item => {
            values.push(userId, item.productId, item.productName || null, item.price || 0, item.quantity || 0, item.image || null);
            return '(?, ?, ?, ?, ?, ?)';
        }).join(', ');
        const sql = `INSERT INTO cart_items (user_id, product_id, productName, price, quantity, image) VALUES ${placeholders}`;
        db.query(sql, values, function (qerr, result) {
            if (qerr) return callback(qerr);
            return callback(null, result);
        });
    });
}

/**
 * Remove single item for user
 */
function removeItem(userId, productId, callback) {
    const sql = 'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?';
    db.query(sql, [userId, productId], function (err, results) {
        if (err) return callback(err);
        return callback(null, { affectedRows: results.affectedRows });
    });
}

module.exports = {
    getByUserId,
    saveCartForUser,
    clearCartForUser,
    removeItem
};